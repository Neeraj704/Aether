import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user_id
from ..db.session import get_db, AsyncSessionLocal
from ..db.models import BotModel, BacktestRunModel, TradeModel, EquityPointModel
from ..schemas.backtest import BacktestRequest, BacktestRunResponse
from ..schemas.graph import BotGraph
from ..engine.backtest_runner import run_backtest

router = APIRouter(tags=["Backtest"])

async def background_backtest_task(bot_graph_dict: dict, config_dict: dict, run_id: str):
    async with AsyncSessionLocal() as session:
        try:
            bot_graph = BotGraph(**bot_graph_dict)
            from ..schemas.backtest import BacktestConfig
            config = BacktestConfig(**config_dict)
            await run_backtest(bot_graph, config, run_id, session)
        except Exception as e:
            print(f"Background task failed for run {run_id}: {e}")
            try:
                from sqlalchemy import update
                await session.rollback()
                await session.execute(
                    update(BacktestRunModel)
                    .where(BacktestRunModel.id == uuid.UUID(run_id))
                    .values(
                        status="error",
                        error_message=f"Simulation task failure: {str(e)}",
                        completed_at=datetime.utcnow(),
                    )
                )
                await session.commit()
            except Exception as persist_err:
                print(f"Failed to persist error status for run {run_id}: {persist_err}")

@router.post("/backtest")
async def start_backtest(
    payload: BacktestRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user ID '{user_id}'")

    raw_bot_id = payload.get_bot_id()
    bot = None

    try:
        bot_uuid = uuid.UUID(raw_bot_id)
        result = await db.execute(
            select(BotModel).where(BotModel.id == bot_uuid, BotModel.user_id == user_uuid)
        )
        bot = result.scalars().first()
    except Exception:
        # If bot_id is not a UUID (e.g. legacy slugId), fetch user's most recent saved bot
        result = await db.execute(
            select(BotModel).where(BotModel.user_id == user_uuid).order_by(BotModel.updated_at.desc())
        )
        bot = result.scalars().first()

    if not bot:
        raise HTTPException(
            status_code=404,
            detail=f"Bot '{raw_bot_id}' not found in database. Please open your bot in the builder and click Save."
        )

    # Support historical and paper trading backtests
    if payload.config.type not in ("historical", "paper", "walk-forward", "monte-carlo"):
        raise HTTPException(status_code=501, detail=f"Simulation type '{payload.config.type}' is not recognized.")

    # Create backtest run row in queued state
    run_id = uuid.uuid4()
    run = BacktestRunModel(
        id=run_id,
        bot_id=bot.id,
        user_id=user_uuid,
        status="queued",
        config=payload.config.model_dump(),
        metrics=None,
        error_message=None,
        created_at=datetime.utcnow(),
    )
    db.add(run)
    await db.commit()

    # Launch execution task in background
    background_tasks.add_task(
        background_backtest_task,
        bot.graph,
        payload.config.model_dump(),
        str(run_id),
    )

    return {
        "runId": str(run_id),
        "status": "queued",
    }

@router.get("/backtest/{run_id}")
async def get_backtest(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        run_uuid = uuid.UUID(run_id)
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid run_id or user_id UUID")

    result = await db.execute(
        select(BacktestRunModel).where(
            BacktestRunModel.id == run_uuid,
            BacktestRunModel.user_id == user_uuid,
        )
    )
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found or not owned by user")

    if run.status != "complete":
        return {
            "id": str(run.id),
            "status": run.status,
            "error_message": run.error_message,
            "errorMessage": run.error_message,
        }

    # Fetch trades
    trades_res = await db.execute(
        select(TradeModel).where(TradeModel.run_id == run_uuid).order_by(TradeModel.entry_time.asc())
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

    # Fetch equity points
    equity_res = await db.execute(
        select(EquityPointModel).where(EquityPointModel.run_id == run_uuid).order_by(EquityPointModel.ts.asc())
    )
    equity_pts = equity_res.scalars().all()
    equity_list = [
        {
            "date": ep.ts.isoformat() if hasattr(ep.ts, "isoformat") else str(ep.ts),
            "equity": float(ep.equity),
            "benchmark": float(ep.benchmark),
            "drawdown": float(ep.drawdown),
        }
        for ep in equity_pts
    ]

    return {
        "id": str(run.id),
        "status": "complete",
        "metrics": run.metrics,
        "trades": trades_list,
        "equity": equity_list,
        "config": run.config,
    }

@router.get("/bots/{bot_id}/backtests")
async def list_bot_backtests(
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
        result = await db.execute(
            select(BotModel).where(BotModel.user_id == user_uuid).order_by(BotModel.updated_at.desc())
        )
        found_bot = result.scalars().first()
        if found_bot:
            bot_uuid = found_bot.id

    if not bot_uuid:
        return []

    stmt = select(BacktestRunModel).where(
        BacktestRunModel.bot_id == bot_uuid,
        BacktestRunModel.user_id == user_uuid,
    ).order_by(BacktestRunModel.created_at.desc())

    res = await db.execute(stmt)
    runs = res.scalars().all()

    return [
        {
            "id": str(r.id),
            "botId": str(r.bot_id),
            "status": r.status,
            "config": r.config or {},
            "metrics": r.metrics or {
                "totalReturn": 0.0,
                "sharpe": 0.0,
                "maxDrawdown": 0.0,
                "winRate": 0.0,
                "trades": 0,
                "profitFactor": 0.0,
            },
            "errorMessage": r.error_message,
            "createdAt": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
            "completedAt": r.completed_at.isoformat() if hasattr(r.completed_at, "isoformat") and r.completed_at else None,
        }
        for r in runs
    ]

@router.delete("/backtest/{run_id}")
async def delete_backtest(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        run_uuid = uuid.UUID(run_id)
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid run_id or user_id UUID")

    result = await db.execute(
        select(BacktestRunModel).where(
            BacktestRunModel.id == run_uuid,
            BacktestRunModel.user_id == user_uuid,
        )
    )
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found")

    await db.delete(run)
    await db.commit()
    return {"status": "deleted", "id": run_id}

