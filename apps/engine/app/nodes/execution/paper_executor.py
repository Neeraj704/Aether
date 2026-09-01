import uuid
from typing import Any, Dict, Optional
from ..base import NodeContext, ClosedTrade
from ...engine.slippage import fill_price

class PaperExecutorNode:
    component_id = "paper-executor"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Optional[ClosedTrade]:
        """
        Simulates order execution with slippage and commissions against running portfolio.
        Returns ClosedTrade when a position exits.
        """
        cfg = {**self.config, **config}
        
        # Look for upstream RiskDecision
        decision = None
        for out in ctx.upstream_outputs.values():
            if isinstance(out, dict) and out.get("type") == "RiskDecision":
                decision = out
                break

        candle = ctx.candle
        if isinstance(candle, dict):
            candle_high = float(candle.get("high", 0.0))
            candle_low = float(candle.get("low", 0.0))
            candle_close = float(candle.get("close", 0.0))
            candle_volume = float(candle.get("volume", 1000.0))
            open_time = candle.get("open_time")
            symbol = candle.get("symbol", "BTCUSDT")
        else:
            candle_high = float(getattr(candle, "high", 0.0))
            candle_low = float(getattr(candle, "low", 0.0))
            candle_close = float(getattr(candle, "close", 0.0))
            candle_volume = float(getattr(candle, "volume", 1000.0))
            open_time = getattr(candle, "open_time", None)
            symbol = getattr(candle, "symbol", "BTCUSDT")

        slippage_override = float(cfg["slippage"]) if "slippage" in cfg and cfg["slippage"] is not None else None
        fees_bps = float(cfg.get("fees", 10.0))

        portfolio = ctx.portfolio
        closed_trade: Optional[ClosedTrade] = None

        # 1. Check existing position stop-loss or opposing exit
        if portfolio.has_position():
            pos = portfolio.position
            should_close = False
            exit_reason = ""

            # Check stop loss
            if pos["side"] == "long" and pos.get("stop_price") is not None and candle_low <= pos["stop_price"]:
                should_close = True
                exit_price = pos["stop_price"]
                exit_reason = f"Stop Loss Triggered @ ₹{pos['stop_price']:,.2f} (Low hit ₹{candle_low:,.2f})"
            elif pos["side"] == "short" and pos.get("stop_price") is not None and candle_high >= pos["stop_price"]:
                should_close = True
                exit_price = pos["stop_price"]
                exit_reason = f"Stop Loss Triggered @ ₹{pos['stop_price']:,.2f} (High hit ₹{candle_high:,.2f})"
            # Check opposing signal
            elif decision and decision.get("approved") and decision.get("direction") != pos["side"]:
                should_close = True
                exit_price = fill_price(
                    candle_close,
                    "short" if pos["side"] == "long" else "long",
                    candle_high,
                    candle_low,
                    pos["size"],
                    candle_volume,
                    slippage_override,
                    fees_bps,
                )
                exit_reason = f"Opposing Signal Reversal ({decision.get('direction').upper()})"

            if should_close:
                # Calculate PnL
                entry_price = pos["entry_price"]
                size = pos["size"]
                if pos["side"] == "long":
                    gross_pnl = (exit_price - entry_price) * size
                else:
                    gross_pnl = (entry_price - exit_price) * size

                fee_cost = (entry_price * size + exit_price * size) * (fees_bps / 10000.0)
                net_pnl = gross_pnl - fee_cost
                pnl_pct = (net_pnl / (entry_price * size)) * 100.0 if (entry_price * size) > 0 else 0.0

                portfolio.close_position(exit_price, net_pnl)

                # Assemble full DAG execution flow trace
                entry_candle = pos.get("entry_candle", {})
                entry_features = pos.get("entry_features", {})
                entry_signal = pos.get("entry_signal", {})
                entry_risk = pos.get("entry_risk", {})

                execution_flow = {
                    "tradeId": f"trade-{uuid.uuid4().hex[:8]}",
                    "symbol": symbol,
                    "side": pos["side"],
                    "summary": {
                        "entryTime": str(pos["entry_time"]),
                        "exitTime": str(open_time),
                        "entryPrice": round(entry_price, 2),
                        "exitPrice": round(exit_price, 2),
                        "size": round(size, 4),
                        "grossPnl": round(gross_pnl, 2),
                        "netPnl": round(net_pnl, 2),
                        "pnlPct": round(pnl_pct, 2),
                        "exitReason": exit_reason,
                        "feesPaid": round(fee_cost, 2),
                        "confidence": round(pos.get("confidence", 0.75), 2),
                    },
                    "steps": [
                        {
                            "stepIndex": 1,
                            "layer": "data",
                            "nodeId": "ohlcv-feed",
                            "nodeName": "OHLCV Price Feed",
                            "status": "completed",
                            "input": {
                                "symbol": symbol,
                                "resolution": "15m",
                                "timestamp": str(pos["entry_time"]),
                            },
                            "computation": f"Ingested 15m candle bar for {getattr(candle, 'symbol', 'BTCUSDT')} with 200-bar rolling memory buffer.",
                            "output": {
                                "open": float(entry_candle.get("open", entry_price)),
                                "high": float(entry_candle.get("high", entry_price)),
                                "low": float(entry_candle.get("low", entry_price)),
                                "close": float(entry_candle.get("close", entry_price)),
                                "volume": float(entry_candle.get("volume", 1000.0)),
                            },
                        },
                        {
                            "stepIndex": 2,
                            "layer": "features",
                            "nodeId": "ta-indicators",
                            "nodeName": "Technical Indicators",
                            "status": "completed",
                            "input": {
                                "priceClose": float(entry_candle.get("close", entry_price)),
                                "rsiPeriod": 14,
                                "macdFast": 20,
                                "macdSlow": 50,
                            },
                            "computation": (
                                f"Calculated RSI(14)={entry_features.get('rsi', 50):.1f}, "
                                f"EMA Fast={entry_features.get('ema_fast', entry_price):.2f}, "
                                f"EMA Slow={entry_features.get('ema_slow', entry_price):.2f}, "
                                f"MACD={entry_features.get('macd', 0):.2f}."
                            ),
                            "output": entry_features,
                        },
                        {
                            "stepIndex": 3,
                            "layer": "agents",
                            "nodeId": "technical-agent",
                            "nodeName": "Technical Analyst",
                            "status": "completed",
                            "input": {
                                "features": entry_features,
                                "model": entry_signal.get("audit", {}).get("model_config", {}),
                                "systemPrompt": entry_signal.get("audit", {}).get("system_prompt", "Technical momentum analyst"),
                            },
                            "computation": (
                                f"Evaluated directional criteria: {entry_signal.get('rationale', 'Signal generated')}. "
                                f"Applied rule: {entry_signal.get('audit', {}).get('applied_rule', 'Momentum Reversion')}."
                            ),
                            "output": {
                                "direction": pos["side"],
                                "confidence": round(pos.get("confidence", 0.75), 2),
                                "confidencePct": f"{round(pos.get('confidence', 0.75) * 100)}%",
                                "rationale": entry_signal.get("rationale", f"{pos['side'].upper()} momentum triggered"),
                            },
                        },
                        {
                            "stepIndex": 4,
                            "layer": "risk",
                            "nodeId": "risk-gate",
                            "nodeName": "Risk Gate",
                            "status": "completed",
                            "input": {
                                "signal": pos["side"],
                                "confidence": round(pos.get("confidence", 0.75), 2),
                                "portfolioEquity": entry_risk.get("audit", {}).get("portfolio_equity", 100000.0),
                                "maxPosPct": entry_risk.get("audit", {}).get("max_position_pct", 20.0),
                            },
                            "computation": (
                                f"Validated risk threshold & computed position sizing: "
                                f"{entry_risk.get('reason', 'Approved within capital allocation limits')}."
                            ),
                            "output": {
                                "approved": True,
                                "sizedQuantity": round(size, 4),
                                "stopPrice": pos.get("stop_price"),
                                "reason": entry_risk.get("reason", "Approved"),
                            },
                        },
                        {
                            "stepIndex": 5,
                            "layer": "execution",
                            "nodeId": "paper-executor",
                            "nodeName": "Paper Executor",
                            "status": "completed",
                            "input": {
                                "orderSide": pos["side"],
                                "orderQty": round(size, 4),
                                "fillModel": "Volume-scaled market impact slippage",
                                "feesBps": fees_bps,
                            },
                            "computation": (
                                f"Executed entry fill @ ₹{entry_price:,.2f}. "
                                f"Closed position @ ₹{exit_price:,.2f} on condition: {exit_reason}. "
                                f"Net P&L: ₹{net_pnl:,.2f} ({pnl_pct:+.2f}%)."
                            ),
                            "output": {
                                "entryPrice": round(entry_price, 2),
                                "exitPrice": round(exit_price, 2),
                                "netPnl": round(net_pnl, 2),
                                "pnlPct": round(pnl_pct, 2),
                                "exitReason": exit_reason,
                            },
                        },
                    ],
                }

                closed_trade = ClosedTrade(
                    id=execution_flow["tradeId"],
                    symbol=symbol,
                    side=pos["side"],
                    entry_time=pos["entry_time"],
                    exit_time=open_time,
                    size=round(size, 4),
                    pnl=round(net_pnl, 2),
                    pnl_pct=round(pnl_pct, 2),
                    trigger_node="Technical Analyst",
                    confidence=round(pos.get("confidence", 0.75), 2),
                    execution_flow=execution_flow,
                )

        # 2. Enter new position if decision is approved and no open position
        if not portfolio.has_position() and decision and decision.get("approved"):
            side = decision.get("direction")
            order_qty = decision.get("sizedQuantity", 0.0)

            if side in ("long", "short") and order_qty > 0:
                executed_price = fill_price(
                    candle_close,
                    side,
                    candle_high,
                    candle_low,
                    order_qty,
                    candle_volume,
                    slippage_override,
                    fees_bps,
                )

                # Extract upstream nodes data from context
                features_data = {}
                signal_data = {}
                for out in ctx.upstream_outputs.values():
                    if isinstance(out, dict):
                        if out.get("type") == "FeatureVector":
                            features_data = out
                        elif out.get("type") == "Signal":
                            signal_data = out

                candle_snapshot = {
                    "open": float(getattr(candle, "open", candle_close)),
                    "high": float(getattr(candle, "high", candle_close)),
                    "low": float(getattr(candle, "low", candle_close)),
                    "close": candle_close,
                    "volume": candle_volume,
                    "open_time": str(open_time),
                }

                portfolio.open_position(
                    side=side,
                    size=order_qty,
                    entry_price=executed_price,
                    entry_time=open_time,
                    stop_price=decision.get("stopPrice"),
                    confidence=decision.get("confidence", 0.75),
                )
                # Store audit trail context in position
                portfolio.position["entry_candle"] = candle_snapshot
                portfolio.position["entry_features"] = features_data
                portfolio.position["entry_signal"] = signal_data
                portfolio.position["entry_risk"] = decision

        return closed_trade
