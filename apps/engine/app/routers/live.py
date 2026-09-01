import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user_id
from ..db.session import get_db
from ..db.models import BotModel, LiveSessionModel, LiveTradeModel, LiveEquityPointModel
from ..schemas.graph import BotGraph
from ..graph.validate import validate_bot_graph
from ..engine.live_runner import (
    register_bot_job,
    deregister_bot_job,
    extract_bot_resolution_and_interval,
    get_latest_bot_evaluation,
    get_bot_activity_logs,
    evaluate_live_snapshot,
)

router = APIRouter(tags=["Live Trading"])

class StartLiveRequest(BaseModel):
    symbol: str = "BTCUSDT"
    capital: float = Field(default=100000.0, gt=0)

@router.post("/bots/{bot_id}/live/start")
async def start_live_session(
    bot_id: str,
    payload: StartLiveRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id UUID '{user_id}'")

    bot = None
    bot_uuid = None

    try:
        bot_uuid = uuid.UUID(bot_id)
        bot_res = await db.execute(
            select(BotModel).where(BotModel.id == bot_uuid, BotModel.user_id == user_uuid)
        )
        bot = bot_res.scalars().first()
    except Exception:
        # Non-UUID slug ID: fallback search
        pass

    if not bot:
        # Try to find user's bot by most recent if legacy mock id
        res = await db.execute(
            select(BotModel).where(BotModel.user_id == user_uuid).order_by(BotModel.updated_at.desc())
        )
        bot = res.scalars().first()
        if bot:
            bot_uuid = bot.id

    if not bot or not bot_uuid:
        raise HTTPException(
            status_code=404,
            detail=f"Bot '{bot_id}' not found in database. Please open your bot in the builder and click Save before running live.",
        )

    # 2. Validate strategy graph
    bot_graph = BotGraph(**bot.graph)
    validation_result = validate_bot_graph(bot_graph)
    if not validation_result.get("valid", True):
        error_msgs = [
            iss["message"]
            for iss in validation_result.get("issues", [])
            if iss.get("severity") == "error"
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Cannot promote bot to live: graph validation failed. Reasons: {'; '.join(error_msgs)}",
        )

    # 3. Create live session (enforces single active session via DB partial unique index)
    session_id = uuid.uuid4()
    live_session = LiveSessionModel(
        id=session_id,
        bot_id=bot_uuid,
        user_id=user_uuid,
        status="running",
        symbol=payload.symbol.strip().upper(),
        capital=payload.capital,
        cash=payload.capital,
        equity=payload.capital,
        position=None,
        peak_equity=payload.capital,
        max_drawdown=0.0,
        last_bar_time=None,
        started_at=datetime.now(timezone.utc),
        stopped_at=None,
        error_message=None,
    )
    db.add(live_session)

    # Update bot status
    bot.status = "live"

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A live paper-trading session is already active for this bot.",
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start live session: {str(e)}")

    # 4. Register scheduler job
    await register_bot_job(str(bot_uuid), session=db)

    res, interval_s = extract_bot_resolution_and_interval(bot.graph)

    return {
        "sessionId": str(session_id),
        "status": "running",
        "symbol": payload.symbol.strip().upper(),
        "capital": payload.capital,
        "resolution": res,
        "interval": interval_s,
    }

@router.post("/bots/{bot_id}/live/stop")
async def stop_live_session(
    bot_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id UUID '{user_id}'")

    # Always safely deregister scheduler job
    deregister_bot_job(str(bot_id))

    bot_uuid = None
    try:
        bot_uuid = uuid.UUID(bot_id)
    except Exception:
        # Non-UUID mock bot ID
        return {
            "status": "stopped",
            "botId": str(bot_id),
        }

    # 1. Find bot if in DB
    bot_res = await db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.user_id == user_uuid)
    )
    bot = bot_res.scalars().first()

    # 2. Find active live session
    session_res = await db.execute(
        select(LiveSessionModel).where(
            LiveSessionModel.bot_id == bot_uuid,
            LiveSessionModel.user_id == user_uuid,
            LiveSessionModel.status == "running",
        )
    )
    live_session = session_res.scalars().first()
    if live_session:
        live_session.status = "stopped"
        live_session.stopped_at = datetime.now(timezone.utc)

    # 3. Update bot status to paused
    if bot:
        bot.status = "paused"

    try:
        await db.commit()
    except Exception as e:
        print(f"[Live Router] Error persisting stop status for {bot_id}: {e}")
        await db.rollback()

    return {
        "status": "stopped",
        "botId": str(bot_id),
    }

@router.get("/bots/{bot_id}/live/state")
async def get_live_state(
    bot_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id UUID")

    bot_uuid = None
    try:
        bot_uuid = uuid.UUID(bot_id)
    except Exception:
        # Gracefully handle non-UUID mock bots
        return {
            "status": "not_running",
            "botId": str(bot_id),
            "resolution": "1m",
            "interval": 60,
            "session": None,
            "position": None,
            "equity": [],
            "trades": [],
        }

    # Verify bot ownership
    bot_res = await db.execute(
        select(BotModel).where(BotModel.id == bot_uuid, BotModel.user_id == user_uuid)
    )
    bot = bot_res.scalars().first()
    if not bot:
        return {
            "status": "not_running",
            "botId": str(bot_uuid),
            "resolution": "1m",
            "interval": 60,
            "session": None,
            "position": None,
            "equity": [],
            "trades": [],
        }

    resolution, interval_s = extract_bot_resolution_and_interval(bot.graph)

    # Fetch latest live session
    session_res = await db.execute(
        select(LiveSessionModel)
        .where(LiveSessionModel.bot_id == bot_uuid, LiveSessionModel.user_id == user_uuid)
        .order_by(LiveSessionModel.started_at.desc())
    )
    live_session = session_res.scalars().first()

    if not live_session:
        return {
            "status": "not_running",
            "botId": str(bot_uuid),
            "botName": bot.name,
            "resolution": resolution,
            "interval": interval_s,
            "session": None,
            "position": None,
            "equity": [],
            "trades": [],
        }

    # Fetch latest 200 equity points
    eq_res = await db.execute(
        select(LiveEquityPointModel)
        .where(LiveEquityPointModel.live_session_id == live_session.id)
        .order_by(LiveEquityPointModel.ts.asc())
        .limit(200)
    )
    equity_pts = eq_res.scalars().all()
    equity_list = [
        {
            "date": ep.ts.isoformat() if hasattr(ep.ts, "isoformat") else str(ep.ts),
            "equity": float(ep.equity),
            "drawdown": float(ep.drawdown),
        }
        for ep in equity_pts
    ]

    # Fetch latest 50 trades
    trades_res = await db.execute(
        select(LiveTradeModel)
        .where(LiveTradeModel.live_session_id == live_session.id)
        .order_by(LiveTradeModel.entry_time.desc())
        .limit(50)
    )
    trades = trades_res.scalars().all()
    trades_list = [
        {
            "id": str(t.id),
            "symbol": t.symbol,
            "side": t.side,
            "entryTime": t.entry_time.isoformat() if hasattr(t.entry_time, "isoformat") else str(t.entry_time),
            "exitTime": t.exit_time.isoformat() if hasattr(t.exit_time, "isoformat") else str(t.exit_time),
            "size": float(t.size),
            "pnl": float(t.pnl),
            "pnlPct": float(t.pnl_pct),
            "triggerNode": t.trigger_node,
            "confidence": float(t.confidence),
            "executionFlow": t.execution_flow if hasattr(t, "execution_flow") and t.execution_flow is not None else None,
        }
        for t in trades
    ]

    # Fetch or compute latest live evaluation snapshot
    eval_snapshot = get_latest_bot_evaluation(str(bot_uuid))
    if not eval_snapshot and bot.graph:
        eval_snapshot = await evaluate_live_snapshot(
            str(bot_uuid),
            bot.graph,
            symbol=live_session.symbol if live_session else "BTCUSDT",
            session=db,
        )

    activity_logs = get_bot_activity_logs(str(bot_uuid))

    return {
        "status": live_session.status,
        "botId": str(bot_uuid),
        "botName": bot.name,
        "resolution": resolution,
        "interval": interval_s,
        "session": {
            "id": str(live_session.id),
            "botId": str(live_session.bot_id),
            "status": live_session.status,
            "symbol": live_session.symbol,
            "capital": float(live_session.capital),
            "cash": float(live_session.cash),
            "equity": float(live_session.equity),
            "peakEquity": float(live_session.peak_equity),
            "maxDrawdown": float(live_session.max_drawdown),
            "startedAt": live_session.started_at.isoformat() if hasattr(live_session.started_at, "isoformat") else str(live_session.started_at),
            "stoppedAt": live_session.stopped_at.isoformat() if hasattr(live_session.stopped_at, "isoformat") and live_session.stopped_at else None,
            "lastBarTime": live_session.last_bar_time.isoformat() if hasattr(live_session.last_bar_time, "isoformat") and live_session.last_bar_time else None,
            "errorMessage": live_session.error_message,
        },
        "position": live_session.position,
        "equity": equity_list,
        "trades": trades_list,
        "evaluation": eval_snapshot,
        "logs": activity_logs,
    }

@router.get("/live/active")
async def list_active_live_sessions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all active ('running') live sessions for the current authenticated user.
    """
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id UUID")

    stmt = (
        select(LiveSessionModel, BotModel.name, BotModel.graph)
        .join(BotModel, LiveSessionModel.bot_id == BotModel.id)
        .where(
            LiveSessionModel.user_id == user_uuid,
            LiveSessionModel.status == "running",
        )
        .order_by(LiveSessionModel.started_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    active_sessions = []
    for live_session, bot_name, bot_graph in rows:
        resolution, interval_s = extract_bot_resolution_and_interval(bot_graph or {})
        active_sessions.append({
            "id": str(live_session.id),
            "botId": str(live_session.bot_id),
            "botName": bot_name,
            "status": live_session.status,
            "symbol": live_session.symbol,
            "resolution": resolution,
            "interval": interval_s,
            "capital": float(live_session.capital),
            "cash": float(live_session.cash),
            "equity": float(live_session.equity),
            "peakEquity": float(live_session.peak_equity),
            "maxDrawdown": float(live_session.max_drawdown),
            "position": live_session.position,
            "startedAt": live_session.started_at.isoformat() if hasattr(live_session.started_at, "isoformat") else str(live_session.started_at),
            "lastBarTime": live_session.last_bar_time.isoformat() if hasattr(live_session.last_bar_time, "isoformat") and live_session.last_bar_time else None,
        })

    return active_sessions
