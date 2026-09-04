import asyncio
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Any, Tuple, Dict, List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..db.session import AsyncSessionLocal
from ..db.models import BotModel, LiveSessionModel, LiveTradeModel, LiveEquityPointModel
from ..schemas.graph import BotGraph
from ..graph.compiler import compile_graph
from ..data.binance_ingest import fetch_latest_candle, fetch_recent_candles_df
from .bar_runner import build_node_instances, run_one_bar
from .backtest_runner import Portfolio

def make_json_serializable(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (int, float, str, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [make_json_serializable(item) for item in obj]
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return make_json_serializable(obj.__dict__)
    return str(obj)

_scheduler: Optional[AsyncIOScheduler] = None
# In-memory recent live evaluation snapshots per bot
_latest_bot_evaluations: Dict[str, Dict[str, Any]] = {}
# Rolling in-memory execution activity logs (last 50 logs per bot)
_bot_activity_logs: Dict[str, List[Dict[str, Any]]] = {}
# Track consecutive transient tick errors per bot (only halt after 5 in a row)
_bot_consecutive_errors: Dict[str, int] = {}

def set_scheduler(scheduler: AsyncIOScheduler):
    global _scheduler
    _scheduler = scheduler

def get_scheduler() -> Optional[AsyncIOScheduler]:
    global _scheduler
    return _scheduler

def get_latest_bot_evaluation(bot_id: str) -> Optional[Dict[str, Any]]:
    return _latest_bot_evaluations.get(str(bot_id))

def get_bot_activity_logs(bot_id: str) -> List[Dict[str, Any]]:
    return _bot_activity_logs.get(str(bot_id), [])

_log_seq_counter = 0
IST = timezone(timedelta(hours=5, minutes=30))

def clear_bot_activity_logs(bot_id: str):
    _bot_activity_logs[str(bot_id)] = []

def append_bot_log(bot_id: str, log_type: str, text: str, node_name: Optional[str] = None):
    global _log_seq_counter
    _log_seq_counter += 1
    logs = _bot_activity_logs.setdefault(str(bot_id), [])
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    ms = now_ist.strftime("%f")[:3]
    time_str = f"{now_ist.strftime('%I:%M:%S')}.{ms} {now_ist.strftime('%p')}"
    entry = {
        "id": f"log-{int(now_ist.timestamp() * 1000)}-{_log_seq_counter}-{uuid.uuid4().hex[:6]}",
        "time": time_str,
        "type": log_type,
        "node": node_name or "System",
        "text": text,
    }
    logs.insert(0, entry)
    if len(logs) > 1000:
        _bot_activity_logs[str(bot_id)] = logs[:1000]

def extract_bot_resolution_and_interval(bot_graph_dict: dict) -> Tuple[str, int]:
    nodes = bot_graph_dict.get("nodes", []) if isinstance(bot_graph_dict, dict) else []
    for node in nodes:
        if isinstance(node, dict) and node.get("componentId") == "ohlcv-feed" and node.get("enabled", True):
            cfg = node.get("config", {})
            res = str(cfg.get("resolution", "1m"))
            interval_val = cfg.get("interval")
            if interval_val is not None:
                try:
                    return res, max(5, int(interval_val))
                except Exception:
                    pass
            if res == "1m":
                return res, 60
            elif res == "5m":
                return res, 300
            elif res == "15m":
                return res, 900
            elif res == "1h":
                return res, 3600
            return res, 60
    return "1m", 60

def calculate_next_boundary(resolution: str = "1m", interval_seconds: Optional[int] = None) -> datetime:
    now = datetime.now(timezone.utc)
    if interval_seconds and interval_seconds < 60:
        return now + timedelta(seconds=interval_seconds)

    if resolution == "1m":
        return (now + timedelta(minutes=1)).replace(second=2, microsecond=0)
    elif resolution == "5m":
        rem = now.minute % 5
        mins = 5 - rem
        return (now + timedelta(minutes=mins)).replace(second=3, microsecond=0)
    elif resolution == "15m":
        rem = now.minute % 15
        mins = 15 - rem
        return (now + timedelta(minutes=mins)).replace(second=5, microsecond=0)
    elif resolution == "1h":
        return (now + timedelta(hours=1)).replace(minute=0, second=5, microsecond=0)
    elif resolution == "1d":
        return (now + timedelta(days=1)).replace(hour=0, minute=0, second=5, microsecond=0)
    else:
        return (now + timedelta(minutes=1)).replace(second=2, microsecond=0)

async def register_bot_job(bot_id: str, scheduler: Optional[AsyncIOScheduler] = None, session: Optional[AsyncSession] = None) -> bool:
    sched = scheduler or get_scheduler()
    if not sched:
        print(f"[Live Runner] Cannot schedule bot {bot_id}: scheduler is not initialized.")
        return False

    job_id = f"live-{bot_id}"
    resolution = "1m"
    interval_seconds = 60
    should_close_session = False
    if session is None:
        session = AsyncSessionLocal()
        should_close_session = True

    try:
        bot_uuid = uuid.UUID(str(bot_id))
        res = await session.execute(select(BotModel).where(BotModel.id == bot_uuid))
        bot = res.scalars().first()
        if bot and bot.graph:
            resolution, interval_seconds = extract_bot_resolution_and_interval(bot.graph)
    except Exception as e:
        print(f"[Live Runner] Error reading bot graph for {bot_id}: {e}")
    finally:
        if should_close_session:
            await session.close()

    next_run = calculate_next_boundary(resolution, interval_seconds)

    try:
        if sched.get_job(job_id):
            sched.remove_job(job_id)

        if interval_seconds < 60:
            sched.add_job(
                tick_bot,
                trigger="interval",
                seconds=interval_seconds,
                args=[str(bot_id)],
                id=job_id,
                next_run_time=next_run,
                replace_existing=True,
            )
        else:
            sched.add_job(
                tick_bot,
                trigger="interval",
                minutes=max(1, interval_seconds // 60),
                args=[str(bot_id)],
                id=job_id,
                next_run_time=next_run,
                replace_existing=True,
            )

        append_bot_log(bot_id, "system", f"Scheduled recurring {interval_seconds}s execution loop ({resolution} candles).")
        print(f"[Live Runner] Scheduled live job for bot {bot_id} (Resolution: {resolution}, Interval: {interval_seconds}s). Next run: {next_run.isoformat()}")
        return True
    except Exception as e:
        print(f"[Live Runner] Failed to register job for bot {bot_id}: {e}")
        return False

def deregister_bot_job(bot_id: str, scheduler: Optional[AsyncIOScheduler] = None) -> bool:
    sched = scheduler or get_scheduler()
    if not sched:
        return False

    job_id = f"live-{bot_id}"
    try:
        if sched.get_job(job_id):
            sched.remove_job(job_id)
            append_bot_log(bot_id, "system", "Execution loop halted and removed from scheduler.")
            print(f"[Live Runner] Removed scheduled job {job_id}")
            return True
    except Exception as e:
        print(f"[Live Runner] Notice on removing job {job_id}: {e}")
    return False

def build_node_step_summaries(node_instances: list, upstream_outputs: dict, candle: dict, bot_id: str) -> List[Dict[str, Any]]:
    steps = []
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")

    for node, node_inst, cfg in node_instances:
        out = upstream_outputs.get(node.id, {})
        node_name = getattr(node_inst, "name", node.componentId)
        layer = getattr(node_inst, "layer", "logic")
        
        summary = ""
        metric_label = ""
        metric_value = ""

        if isinstance(out, dict):
            out_type = out.get("type", "")
            if out_type == "MarketData":
                close_p = float(out.get("close", candle.get("close", 0)))
                vol = float(out.get("volume", candle.get("volume", 0)))
                summary = f"Ingested {out.get('symbol', 'BTCUSDT')} — Close ${close_p:,.2f}, Vol {vol:,.2f}"
                metric_label = "LTP"
                metric_value = f"${close_p:,.2f}"
                append_bot_log(bot_id, "data", f"OHLCV Ingest: {out.get('symbol')} @ ${close_p:,.2f} (Vol: {vol:,.1f})", node_name)

            elif out_type == "FeatureVector":
                rsi_val = out.get("rsi", 50.0)
                regime = out.get("regime", "Trend")
                ema_f = out.get("ema_fast", 0.0)
                summary = f"RSI: {rsi_val:.1f} | Regime: {regime} | EMA Fast: ${ema_f:,.2f}"
                metric_label = "RSI"
                metric_value = f"{rsi_val:.1f}"
                append_bot_log(bot_id, "features", f"Features: RSI(14)={rsi_val:.1f}, Fast EMA=${ema_f:,.2f}, Regime={regime}", node_name)

            elif out_type == "Signal":
                direction = out.get("direction", "neutral").upper()
                conf = float(out.get("confidence", 0.5))
                conf_pct = int(conf * 100)
                rationale = out.get("rationale", "")
                summary = f"{direction} ({conf_pct}% conviction) — {rationale}"
                metric_label = "Conviction"
                metric_value = f"{conf_pct}% {direction}"
                append_bot_log(bot_id, "signal", f"Signal: {direction} ({conf_pct}% conviction) — {rationale}", node_name)

            elif out_type == "RiskDecision":
                approved = out.get("approved", False)
                reason = out.get("reason", "Threshold verification")
                summary = f"Gate: {'APPROVED' if approved else 'STANDBY'} — {reason}"
                metric_label = "Risk Gate"
                metric_value = "PASS" if approved else "STANDBY"
                append_bot_log(bot_id, "risk", f"Risk Check: {'APPROVED' if approved else 'STANDBY'} — {reason}", node_name)
            else:
                summary = f"Executed {node_name} with status OK"
                metric_label = "Status"
                metric_value = "OK"
        else:
            summary = f"Processed output for {node_name}"
            metric_label = "Status"
            metric_value = "OK"

        steps.append({
            "nodeId": node.id,
            "componentId": node.componentId,
            "nodeName": node_name,
            "layer": layer,
            "summary": summary,
            "metricLabel": metric_label,
            "metricValue": metric_value,
            "output": out if isinstance(out, (dict, list, str, int, float, bool)) else str(out),
        })

    return steps

async def evaluate_live_snapshot(bot_id: str, bot_graph_dict: dict, symbol: str = "BTCUSDT", session: Optional[AsyncSession] = None) -> Optional[Dict[str, Any]]:
    """
    Computes a live inspection snapshot on the latest candle without modifying persisted portfolio state.
    """
    try:
        bot_graph = BotGraph(**bot_graph_dict)
        ordered_nodes = compile_graph(bot_graph)
        resolution, _ = extract_bot_resolution_and_interval(bot_graph_dict)
        candle = await fetch_latest_candle(symbol=symbol, interval=resolution, session=session)
        if not candle:
            return None

        recent_df = await fetch_recent_candles_df(symbol=symbol, interval=resolution, limit=60)

        dummy_portfolio = Portfolio(cash=100000.0)
        node_instances = build_node_instances(ordered_nodes)
        closed_trade, current_eq, ctx = await run_one_bar(
            node_instances,
            candle,
            dummy_portfolio,
            return_context=True,
            historical_window=recent_df,
            mode="live",
            bot_id=str(bot_id),
            db=session,
        )

        steps = build_node_step_summaries(node_instances, ctx.upstream_outputs, candle, bot_id)

        eval_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "resolution": resolution,
            "candle": {
                "symbol": symbol,
                "open": candle.get("open"),
                "high": candle.get("high"),
                "low": candle.get("low"),
                "close": candle.get("close"),
                "volume": candle.get("volume"),
                "openTime": candle.get("open_time").isoformat() if hasattr(candle.get("open_time"), "isoformat") else str(candle.get("open_time")),
            },
            "steps": steps,
        }
        _latest_bot_evaluations[str(bot_id)] = eval_data
        return eval_data
    except Exception as e:
        print(f"[Live Runner] Error generating live snapshot for {bot_id}: {e}")
        return None

async def tick_bot(bot_id: str, session: Optional[AsyncSession] = None):
    """
    Runs one live bar for a single bot's active live session and updates latest evaluation snapshot.
    """
    should_close_session = False
    if session is None:
        session = AsyncSessionLocal()
        should_close_session = True

    try:
        bot_uuid = uuid.UUID(str(bot_id))
    except Exception as e:
        deregister_bot_job(bot_id)
        if should_close_session:
            await session.close()
        return

    try:
        # 1. Load active LiveSessionModel for this bot
        stmt = (
            select(LiveSessionModel)
            .where(
                LiveSessionModel.bot_id == bot_uuid,
                LiveSessionModel.status == "running",
            )
            .order_by(LiveSessionModel.started_at.desc())
        )
        res = await session.execute(stmt)
        live_session = res.scalars().first()

        if not live_session:
            deregister_bot_job(str(bot_id))
            if should_close_session:
                await session.close()
            return

        # 2. Load BotModel and compile graph
        bot_res = await session.execute(select(BotModel).where(BotModel.id == bot_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            raise ValueError(f"Bot {bot_id} not found in database")

        bot_graph = BotGraph(**bot.graph)
        ordered_nodes = compile_graph(bot_graph)
        resolution, interval_s = extract_bot_resolution_and_interval(bot.graph)

        # 3. Fetch latest closed candle and historical window
        symbol = live_session.symbol or "BTCUSDT"
        candle = await fetch_latest_candle(symbol=symbol, interval=resolution, session=session)
        if not candle:
            if should_close_session:
                await session.close()
            return

        recent_df = await fetch_recent_candles_df(symbol=symbol, interval=resolution, limit=60)

        # Check if candle was already processed
        candle_open_time = candle["open_time"]
        already_processed = False
        if live_session.last_bar_time:
            last_bt = live_session.last_bar_time
            if last_bt.tzinfo is None:
                last_bt = last_bt.replace(tzinfo=timezone.utc)
            if candle_open_time <= last_bt:
                already_processed = True

        # 4. Reconstruct Portfolio
        portfolio = Portfolio(cash=float(live_session.cash))
        portfolio.initial_capital = float(live_session.capital)
        portfolio.equity = float(live_session.equity)
        portfolio.peak_equity = float(live_session.peak_equity)
        portfolio.max_dd = float(live_session.max_drawdown)
        if live_session.position:
            portfolio.position = dict(live_session.position)

        # 5. Build node instances and execute bar
        node_instances = build_node_instances(ordered_nodes)
        closed_trade, current_equity, ctx = await run_one_bar(
            node_instances,
            candle,
            portfolio,
            return_context=True,
            historical_window=recent_df,
            mode="live",
            user_id=str(live_session.user_id),
            bot_id=str(live_session.bot_id),
            live_session_id=str(live_session.id),
            db=session,
        )

        # Generate node step inspection details & logs
        steps = build_node_step_summaries(node_instances, ctx.upstream_outputs, candle, str(bot_id))
        
        _latest_bot_evaluations[str(bot_id)] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "resolution": resolution,
            "candle": {
                "symbol": symbol,
                "open": candle.get("open"),
                "high": candle.get("high"),
                "low": candle.get("low"),
                "close": candle.get("close"),
                "volume": candle.get("volume"),
                "openTime": candle.get("open_time").isoformat() if hasattr(candle.get("open_time"), "isoformat") else str(candle.get("open_time")),
            },
            "steps": steps,
        }

        # If this is a new closed bar, persist state
        if not already_processed:
            live_session.cash = portfolio.cash
            live_session.equity = portfolio.equity
            live_session.position = make_json_serializable(portfolio.position) if portfolio.position else None
            live_session.peak_equity = portfolio.peak_equity
            live_session.max_drawdown = portfolio.max_dd
            live_session.last_bar_time = candle_open_time

            equity_pt = LiveEquityPointModel(
                live_session_id=live_session.id,
                ts=candle_open_time,
                equity=portfolio.equity,
                drawdown=portfolio.current_drawdown(),
            )
            session.add(equity_pt)

            if closed_trade:
                trade_model = LiveTradeModel(
                    id=uuid.uuid4(),
                    live_session_id=live_session.id,
                    symbol=closed_trade.symbol,
                    side=closed_trade.side,
                    entry_time=closed_trade.entry_time if isinstance(closed_trade.entry_time, datetime) else datetime.fromisoformat(str(closed_trade.entry_time).replace("Z", "+00:00")),
                    exit_time=closed_trade.exit_time if isinstance(closed_trade.exit_time, datetime) else datetime.fromisoformat(str(closed_trade.exit_time).replace("Z", "+00:00")),
                    size=closed_trade.size,
                    pnl=closed_trade.pnl,
                    pnl_pct=closed_trade.pnl_pct,
                    trigger_node=closed_trade.trigger_node,
                    confidence=closed_trade.confidence,
                    execution_flow=make_json_serializable(getattr(closed_trade, "execution_flow", {})),
                )
                session.add(trade_model)
                append_bot_log(str(bot_id), "fill", f"ORDER CLOSED: {closed_trade.side.upper()} {closed_trade.symbol} P&L: ₹{closed_trade.pnl:+,.2f}")

            await session.commit()
            _bot_consecutive_errors[str(bot_id)] = 0
            print(f"[Live Runner] Processed closed bar tick for bot {bot_id} ({resolution}). Equity: {portfolio.equity}")

    except Exception as e:
        if isinstance(e, asyncio.CancelledError):
            print(f"[Live Runner] Tick cancelled for bot {bot_id} (system reload/shutdown).")
            return

        err_msg = str(e) or repr(e)
        err_count = _bot_consecutive_errors.get(str(bot_id), 0) + 1
        _bot_consecutive_errors[str(bot_id)] = err_count

        print(f"[Live Runner] Transient tick error ({err_count}/5) for bot {bot_id}: {err_msg}")
        append_bot_log(str(bot_id), "warn", f"Tick notice ({err_count}/5): {err_msg}. Retrying next tick...")

        try:
            await session.rollback()
        except Exception:
            pass

        # Only halt and deregister if it fails repeatedly 5 times consecutively
        if err_count >= 5:
            print(f"[Live Runner] Halting bot {bot_id} after 5 consecutive tick failures.")
            append_bot_log(str(bot_id), "warn", f"Halted: 5 consecutive failures. Last error: {err_msg}")
            try:
                await session.execute(
                    update(LiveSessionModel)
                    .where(
                        LiveSessionModel.bot_id == bot_uuid,
                        LiveSessionModel.status == "running",
                    )
                    .values(
                        status="error",
                        error_message=f"Halted after 5 consecutive failures: {err_msg}",
                        stopped_at=datetime.now(timezone.utc),
                    )
                )
                await session.execute(
                    update(BotModel)
                    .where(BotModel.id == bot_uuid)
                    .values(status="error")
                )
                await session.commit()
            except Exception as persist_err:
                print(f"[Live Runner] Failed to persist error state: {persist_err}")

            deregister_bot_job(str(bot_id))

    finally:
        if should_close_session:
            await session.close()
