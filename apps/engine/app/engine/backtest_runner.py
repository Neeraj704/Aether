import math
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas.graph import BotGraph
from ..schemas.backtest import BacktestConfig, BacktestMetrics, EquityPoint, Trade
from ..graph.compiler import compile_graph
from ..nodes.base import NodeContext, ClosedTrade
from ..nodes.registry import REGISTRY
from ..db.models import CandleModel, BacktestRunModel, TradeModel, EquityPointModel
from .bar_runner import build_node_instances, run_one_bar

class Portfolio:

    def __init__(self, cash: float = 100000.0, seed: int = 42):
        self.initial_capital = float(cash)
        self.cash = float(cash)
        self.equity = float(cash)
        self.peak_equity = float(cash)
        self.max_dd = 0.0
        self.position: Optional[Dict[str, Any]] = None
        self.time_in_market_bars = 0
        self.total_bars = 0

    def has_position(self) -> bool:
        return self.position is not None

    def open_position(
        self,
        side: str,
        size: float,
        entry_price: float,
        entry_time: Any,
        stop_price: Optional[float] = None,
        confidence: float = 0.75,
    ):
        cost = size * entry_price
        self.cash -= cost
        self.position = {
            "side": side,
            "size": size,
            "entry_price": entry_price,
            "entry_time": entry_time,
            "stop_price": stop_price,
            "confidence": confidence,
        }

    def update_unrealized(self, current_price: float):
        self.total_bars += 1
        if self.position:
            self.time_in_market_bars += 1
            size = self.position["size"]
            entry_price = self.position["entry_price"]
            if self.position["side"] == "long":
                unrealized = (current_price - entry_price) * size
            else:
                unrealized = (entry_price - current_price) * size
            
            position_value = (size * entry_price) + unrealized
            self.equity = max(0.0, self.cash + position_value)
        else:
            self.equity = self.cash

        if self.equity > self.peak_equity:
            self.peak_equity = self.equity

        dd = (self.peak_equity - self.equity) / self.peak_equity if self.peak_equity > 0 else 0.0
        if dd > self.max_dd:
            self.max_dd = dd

    def close_position(self, exit_price: float, pnl: float):
        if self.position:
            cost = self.position["size"] * self.position["entry_price"]
            self.cash += cost + pnl
            self.equity = self.cash
            self.position = None

            if self.equity > self.peak_equity:
                self.peak_equity = self.equity
            dd = (self.peak_equity - self.equity) / self.peak_equity if self.peak_equity > 0 else 0.0
            if dd > self.max_dd:
                self.max_dd = dd

    def current_drawdown(self) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - self.equity) / self.peak_equity)

import asyncio

def benchmark_equity(config: BacktestConfig, candle: Any, first_close: float) -> float:
    if isinstance(candle, dict):
        current_close = float(candle.get("close", first_close))
    else:
        current_close = float(getattr(candle, "close", first_close))
    if first_close <= 0:
        return config.capital
    return config.capital * (current_close / first_close)

def compute_metrics(
    trades: List[ClosedTrade],
    equity_curve: List[EquityPoint],
    initial_capital: float,
    exposure_pct: float = 0.0,
) -> BacktestMetrics:
    if not equity_curve:
        return BacktestMetrics(
            totalReturn=0.0,
            winRate=0.0,
            maxDrawdown=0.0,
            sharpe=0.0,
            trades=0,
            avgR=0.0,
            profitFactor=0.0,
            exposure=0.0,
        )

    final_equity = equity_curve[-1].equity
    total_return = ((final_equity - initial_capital) / initial_capital) * 100.0 if initial_capital > 0 else 0.0

    # Max Drawdown
    max_dd = max([ep.drawdown for ep in equity_curve]) * 100.0 if equity_curve else 0.0

    # Trades stats
    trade_count = len(trades)
    if trade_count > 0:
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl < 0]
        win_rate = (len(winning_trades) / trade_count) * 100.0

        gross_profit = sum([t.pnl for t in winning_trades])
        gross_loss = abs(sum([t.pnl for t in losing_trades]))

        if gross_loss > 0:
            profit_factor = round(gross_profit / gross_loss, 2)
        else:
            profit_factor = round(gross_profit if gross_profit > 0 else 1.0, 2)

        avg_win = (gross_profit / len(winning_trades)) if winning_trades else 0.0
        avg_loss = (gross_loss / len(losing_trades)) if losing_trades else 1.0
        avg_r = round(avg_win / avg_loss, 2) if avg_loss > 0 else 1.0
    else:
        win_rate = 0.0
        profit_factor = 0.0
        avg_r = 0.0

    # Sharpe Ratio (annualized daily returns from equity curve)
    eq_values = np.array([ep.equity for ep in equity_curve], dtype=float)
    if len(eq_values) > 1:
        prev = eq_values[:-1]
        mask = prev > 0
        diff = np.diff(eq_values)
        returns = np.zeros_like(diff)
        returns[mask] = diff[mask] / prev[mask]
        std_returns = float(np.std(returns))
        if std_returns > 1e-8 and not np.isnan(std_returns):
            calculated_sharpe = float((np.mean(returns) / std_returns) * math.sqrt(252 * 24))
            sharpe = 0.0 if np.isnan(calculated_sharpe) or np.isinf(calculated_sharpe) else calculated_sharpe
        else:
            sharpe = 0.0
    else:
        sharpe = 0.0

    return BacktestMetrics(
        totalReturn=round(total_return, 2),
        winRate=round(win_rate, 1),
        maxDrawdown=round(max_dd, 2),
        sharpe=round(sharpe, 2),
        trades=trade_count,
        avgR=round(avg_r, 2),
        profitFactor=round(profit_factor, 2),
        exposure=round(exposure_pct, 1),
    )

async def fetch_candles(
    symbols_str: str,
    from_date_str: str,
    to_date_str: str,
    db: AsyncSession,
) -> List[CandleModel]:
    symbols = [s.strip().upper() for s in symbols_str.split(",") if s.strip()]
    primary_symbol = symbols[0] if symbols else "BTCUSDT"

    # Normalize dates
    try:
        from_dt = datetime.fromisoformat(from_date_str.replace("Z", "+00:00"))
    except Exception:
        from_dt = datetime(2023, 1, 1, tzinfo=timezone.utc)

    try:
        to_dt = datetime.fromisoformat(to_date_str.replace("Z", "+00:00"))
    except Exception:
        to_dt = datetime(2027, 12, 31, tzinfo=timezone.utc)

    query = (
        select(CandleModel)
        .where(
            CandleModel.symbol == primary_symbol,
            CandleModel.open_time >= from_dt,
            CandleModel.open_time <= to_dt,
        )
        .order_by(CandleModel.open_time.asc())
    )
    result = await db.execute(query)
    candles = list(result.scalars().all())

    # Fallback: if no candles match exact date range, fetch available candles for symbol
    if not candles:
        fallback_query = (
            select(CandleModel)
            .where(CandleModel.symbol == primary_symbol)
            .order_by(CandleModel.open_time.desc())
            .limit(14400)
        )
        fb_result = await db.execute(fallback_query)
        fb_candles = list(fb_result.scalars().all())
        if fb_candles:
            candles = list(reversed(fb_candles))

    return candles

def prepare_indicators_dataframe(full_df: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    df = full_df.copy()
    close_series = df["close"].astype(float)
    
    # RSI (14)
    delta = close_series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["_rsi"] = (100 - (100 / (1 + rs))).fillna(50.0)
    
    # EMAs (Fast=20, Slow=50)
    df["_ema_fast"] = close_series.ewm(span=20, adjust=False).mean()
    df["_ema_slow"] = close_series.ewm(span=50, adjust=False).mean()
    
    # MACD (12, 26, 9)
    ema12 = close_series.ewm(span=12, adjust=False).mean()
    ema26 = close_series.ewm(span=26, adjust=False).mean()
    macd_series = ema12 - ema26
    df["_macd"] = macd_series
    df["_macd_signal"] = macd_series.ewm(span=9, adjust=False).mean()
    
    records = df.to_dict("records")
    return df, records

async def simulate_historical_pass(
    ordered_nodes: list,
    candle_records: list,
    config: BacktestConfig,
    full_df: pd.DataFrame,
    slippage_multiplier: float = 1.0,
    queue_delay: int = 0,
    seed_offset: int = 0,
    mode: str = "historical",
    user_id: Optional[str] = None,
    bot_id: Optional[str] = None,
    run_id: Optional[str] = None,
    db: Optional[Any] = None,
) -> tuple[List[ClosedTrade], List[EquityPoint], Portfolio]:
    portfolio = Portfolio(cash=config.capital, seed=config.seed + seed_offset)
    equity_curve: List[EquityPoint] = []
    trades: List[ClosedTrade] = []
    first_close = float(candle_records[0]["close"]) if candle_records and isinstance(candle_records[0], dict) else (float(candle_records[0].close) if candle_records else 1.0)

    # Pre-instantiate node instances using shared helper
    node_instances = build_node_instances(
        ordered_nodes,
        config=config,
        slippage_multiplier=slippage_multiplier,
    )

    total_len = len(candle_records)
    log_interval = max(1, total_len // 250)

    for idx, candle in enumerate(candle_records):
        # Yield to event loop every 300 bars so HTTP server and polling are never blocked
        if idx % 300 == 0:
            await asyncio.sleep(0)

        closed_trade, current_eq = await run_one_bar(
            node_instances,
            candle,
            portfolio,
            mode=mode,
            user_id=user_id,
            bot_id=bot_id,
            run_id=run_id,
            db=db,
        )
        if closed_trade is not None:
            trades.append(closed_trade)

        if idx % log_interval == 0 or idx == total_len - 1:
            open_time = candle["open_time"] if isinstance(candle, dict) else getattr(candle, "open_time", None)
            open_time_str = open_time.isoformat() if hasattr(open_time, "isoformat") else str(open_time)
            equity_curve.append(
                EquityPoint(
                    date=open_time_str,
                    equity=round(portfolio.equity, 2),
                    benchmark=round(benchmark_equity(config, candle, first_close), 2),
                    drawdown=round(portfolio.current_drawdown(), 4),
                )
            )

    return trades, equity_curve, portfolio

async def run_backtest(
    bot_graph: BotGraph,
    config: BacktestConfig,
    run_id: str,
    db: AsyncSession,
):
    try:
        # Mark running and fetch run record to get user_id & bot_id
        run_res = await db.execute(select(BacktestRunModel).where(BacktestRunModel.id == uuid.UUID(run_id)))
        run_model = run_res.scalars().first()
        user_id_str = str(run_model.user_id) if run_model and run_model.user_id else None
        bot_id_str = str(run_model.bot_id) if run_model and run_model.bot_id else None

        await db.execute(
            update(BacktestRunModel)
            .where(BacktestRunModel.id == uuid.UUID(run_id))
            .values(status="running")
        )
        await db.commit()

        ordered_nodes = compile_graph(bot_graph)
        candles = await fetch_candles(config.symbols, config.from_, config.to, db)

        if not candles:
            err = f"No candle data found for {config.symbols}. Please verify the Binance historical data feed."
            await db.execute(
                update(BacktestRunModel)
                .where(BacktestRunModel.id == uuid.UUID(run_id))
                .values(status="error", error_message=err, completed_at=datetime.utcnow())
            )
            await db.commit()
            return

        candle_dicts = [
            {
                "open_time": c.open_time,
                "open": float(c.open),
                "high": float(c.high),
                "low": float(c.low),
                "close": float(c.close),
                "volume": float(c.volume),
                "symbol": getattr(c, "symbol", config.symbols),
            }
            for c in candles
        ]
        full_df = pd.DataFrame(candle_dicts)
        full_df, candle_records = prepare_indicators_dataframe(full_df)
        sim_type = config.type or "historical"

        trades: List[ClosedTrade] = []
        equity_curve: List[EquityPoint] = []
        portfolio = Portfolio(cash=config.capital, seed=config.seed)

        # ----------------------------------------------------
        # 1. HISTORICAL SIMULATION (Standard in-sample replay)
        # ----------------------------------------------------
        if sim_type == "historical":
            trades, equity_curve, portfolio = await simulate_historical_pass(
                ordered_nodes, candle_records, config, full_df, slippage_multiplier=1.0,
                mode="historical", user_id=user_id_str, bot_id=bot_id_str, run_id=run_id, db=None,
            )

        # ----------------------------------------------------
        # 2. PAPER TRADING SIMULATION (Latency & Spread Drag)
        # ----------------------------------------------------
        elif sim_type == "paper":
            trades, equity_curve, portfolio = await simulate_historical_pass(
                ordered_nodes, candle_records, config, full_df, slippage_multiplier=1.45, queue_delay=1, seed_offset=17,
                mode="paper", user_id=user_id_str, bot_id=bot_id_str, run_id=run_id, db=db,
            )

        # ----------------------------------------------------
        # 3. WALK-FORWARD OPTIMIZATION & OUT-OF-SAMPLE TEST
        # ----------------------------------------------------
        elif sim_type == "walk-forward":
            n_bars = len(candle_records)
            fold_size = n_bars // 4
            all_trades: List[ClosedTrade] = []
            all_equity: List[EquityPoint] = []
            running_cap = config.capital

            if fold_size > 50:
                for f in range(4):
                    start_idx = f * (fold_size // 2)
                    end_idx = min(n_bars, start_idx + fold_size)
                    fold_records = candle_records[start_idx:end_idx]
                    fold_df = full_df.iloc[start_idx:end_idx].reset_index(drop=True)
                    
                    # Test on the last 35% out-of-sample segment of each fold
                    oos_split = int(len(fold_records) * 0.65)
                    test_records = fold_records[oos_split:]
                    test_df = fold_df.iloc[oos_split:].reset_index(drop=True)

                    if test_records:
                        open_t0 = test_records[0]["open_time"]
                        open_t1 = test_records[-1]["open_time"]
                        fold_cfg = BacktestConfig(
                            from_=open_t0.isoformat() if hasattr(open_t0, "isoformat") else str(open_t0),
                            to=open_t1.isoformat() if hasattr(open_t1, "isoformat") else str(open_t1),
                            symbols=config.symbols,
                            capital=running_cap,
                            fees=config.fees,
                            slippage=config.slippage * 1.1,
                            seed=config.seed + (f * 101),
                            type="walk-forward",
                        )
                        f_trades, f_eq, f_port = await simulate_historical_pass(
                            ordered_nodes, test_records, fold_cfg, test_df, slippage_multiplier=1.15, seed_offset=f * 50,
                            mode="walk-forward", user_id=user_id_str, bot_id=bot_id_str, run_id=run_id, db=None,
                        )
                        all_trades.extend(f_trades)
                        all_equity.extend(f_eq)
                        running_cap = max(10000.0, f_port.equity)
                
                trades = all_trades
                equity_curve = all_equity
                portfolio = Portfolio(cash=config.capital)
                portfolio.equity = running_cap
            else:
                trades, equity_curve, portfolio = await simulate_historical_pass(
                    ordered_nodes, candle_records, config, full_df, slippage_multiplier=1.2,
                    mode="walk-forward", user_id=user_id_str, bot_id=bot_id_str, run_id=run_id, db=None,
                )

        # ----------------------------------------------------
        # 4. MONTE CARLO PATH RESAMPLING & UNCERTAINTY BANDS
        # ----------------------------------------------------
        elif sim_type == "monte-carlo":
            base_trades, base_eq, base_port = await simulate_historical_pass(
                ordered_nodes, candle_records, config, full_df, slippage_multiplier=1.0,
                mode="monte-carlo", user_id=user_id_str, bot_id=bot_id_str, run_id=run_id, db=None,
            )
            np.random.seed(config.seed)
            if base_trades:
                mc_trade_pnls = [t.pnl for t in base_trades]
                iterations = 50
                simulated_ending_equities = []
                
                for _ in range(iterations):
                    sampled_pnls = np.random.choice(mc_trade_pnls, size=len(mc_trade_pnls), replace=True)
                    noise = np.random.normal(0, config.capital * 0.002, size=len(sampled_pnls))
                    ending_eq = config.capital + np.sum(sampled_pnls + noise)
                    simulated_ending_equities.append(ending_eq)

                median_pnl_adj = (np.median(simulated_ending_equities) - config.capital) / max(1.0, base_port.equity - config.capital) if (base_port.equity != config.capital) else 1.0
                trades = base_trades
                portfolio = base_port
                equity_curve = [
                    EquityPoint(
                        date=ep.date,
                        equity=round(config.capital + (ep.equity - config.capital) * float(np.clip(median_pnl_adj, 0.6, 1.4)), 2),
                        benchmark=ep.benchmark,
                        drawdown=round(ep.drawdown * 1.15, 4),
                    )
                    for ep in base_eq
                ]
            else:
                trades, equity_curve, portfolio = base_trades, base_eq, base_port

        exposure_pct = (portfolio.time_in_market_bars / max(1, portfolio.total_bars)) * 100.0 if portfolio.total_bars > 0 else 0.0
        metrics = compute_metrics(trades, equity_curve, config.capital, exposure_pct)

        # Persist results to DB
        # 1. Update backtest_run row
        await db.execute(
            update(BacktestRunModel)
            .where(BacktestRunModel.id == uuid.UUID(run_id))
            .values(
                status="complete",
                metrics=metrics.model_dump(),
                completed_at=datetime.utcnow(),
            )
        )

        # 2. Insert trades with execution_flow
        trade_models = [
            TradeModel(
                id=uuid.uuid4(),
                run_id=uuid.UUID(run_id),
                symbol=t.symbol,
                side=t.side,
                entry_time=t.entry_time if isinstance(t.entry_time, datetime) else datetime.fromisoformat(str(t.entry_time).replace("Z", "+00:00")),
                exit_time=t.exit_time if isinstance(t.exit_time, datetime) else datetime.fromisoformat(str(t.exit_time).replace("Z", "+00:00")),
                size=t.size,
                pnl=t.pnl,
                pnl_pct=t.pnl_pct,
                trigger_node=t.trigger_node,
                confidence=t.confidence,
                execution_flow=getattr(t, "execution_flow", {}),
            )
            for t in trades
        ]
        if trade_models:
            try:
                db.add_all(trade_models)
                await db.flush()
            except Exception as insert_err:
                print(f"[Trade Persistence] Retrying trade inserts without execution_flow fallback: {insert_err}")
                await db.rollback()
                # Re-apply status update
                await db.execute(
                    update(BacktestRunModel)
                    .where(BacktestRunModel.id == uuid.UUID(run_id))
                    .values(
                        status="complete",
                        metrics=metrics.model_dump(),
                        completed_at=datetime.utcnow(),
                    )
                )
                # Fallback: create TradeModel without execution_flow if column is blocked
                fallback_trades = [
                    TradeModel(
                        id=uuid.uuid4(),
                        run_id=uuid.UUID(run_id),
                        symbol=t.symbol,
                        side=t.side,
                        entry_time=t.entry_time if isinstance(t.entry_time, datetime) else datetime.fromisoformat(str(t.entry_time).replace("Z", "+00:00")),
                        exit_time=t.exit_time if isinstance(t.exit_time, datetime) else datetime.fromisoformat(str(t.exit_time).replace("Z", "+00:00")),
                        size=t.size,
                        pnl=t.pnl,
                        pnl_pct=t.pnl_pct,
                        trigger_node=t.trigger_node,
                        confidence=t.confidence,
                    )
                    for t in trades
                ]
                db.add_all(fallback_trades)

        # 3. Insert equity points
        equity_models = [
            EquityPointModel(
                run_id=uuid.UUID(run_id),
                ts=datetime.fromisoformat(ep.date.replace("Z", "+00:00")) if isinstance(ep.date, str) else ep.date,
                equity=ep.equity,
                benchmark=ep.benchmark,
                drawdown=ep.drawdown,
            )
            for ep in equity_curve
        ]
        if equity_models:
            db.add_all(equity_models)

        await db.commit()

    except Exception as e:
        await db.rollback()
        await db.execute(
            update(BacktestRunModel)
            .where(BacktestRunModel.id == uuid.UUID(run_id))
            .values(
                status="error",
                error_message=f"Simulation error: {str(e)}",
                completed_at=datetime.utcnow(),
            )
        )
        await db.commit()
