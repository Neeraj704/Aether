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
        
        # Look for upstream RiskDecision (most immediate predecessor)
        decision = None
        for out in reversed(list(ctx.upstream_outputs.values())):
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
            pos["bars_held"] = pos.get("bars_held", 0) + 1
            should_close = False
            exit_reason = ""

            # Dynamic ATR trailing stop once trade moves into profit:
            # When trade gains >= 1.5%, trail stop behind the high/low by 1.2%
            if pos["side"] == "long" and candle_high >= pos["entry_price"] * 1.015:
                trail_stop = candle_high * 0.988
                if pos.get("stop_price") is None or trail_stop > pos["stop_price"]:
                    pos["stop_price"] = trail_stop
            elif pos["side"] == "short" and candle_low <= pos["entry_price"] * 0.985:
                trail_stop = candle_low * 1.012
                if pos.get("stop_price") is None or trail_stop < pos["stop_price"]:
                    pos["stop_price"] = trail_stop

            # 1a. Check Take Profit Target
            if pos["side"] == "long" and pos.get("target_price") is not None and candle_high >= pos["target_price"]:
                should_close = True
                exit_price = pos["target_price"]
                exit_reason = f"Take Profit Target Hit @ ₹{pos['target_price']:,.2f} (High reached ₹{candle_high:,.2f})"
            elif pos["side"] == "short" and pos.get("target_price") is not None and candle_low <= pos["target_price"]:
                should_close = True
                exit_price = pos["target_price"]
                exit_reason = f"Take Profit Target Hit @ ₹{pos['target_price']:,.2f} (Low reached ₹{candle_low:,.2f})"
            # 1b. Check Stop Loss
            elif pos["side"] == "long" and pos.get("stop_price") is not None and candle_low <= pos["stop_price"]:
                should_close = True
                exit_price = pos["stop_price"]
                exit_reason = f"Stop Loss Triggered @ ₹{pos['stop_price']:,.2f} (Low hit ₹{candle_low:,.2f})"
            elif pos["side"] == "short" and pos.get("stop_price") is not None and candle_high >= pos["stop_price"]:
                should_close = True
                exit_price = pos["stop_price"]
                exit_reason = f"Stop Loss Triggered @ ₹{pos['stop_price']:,.2f} (High hit ₹{candle_high:,.2f})"
            # 1c. Check opposing signal (only exit on high-conviction opposing reversal or after minimum bars held)
            elif (
                decision
                and decision.get("approved")
                and decision.get("direction") != pos["side"]
                and (pos.get("bars_held", 0) >= 3 or float(decision.get("confidence", 0.0)) >= 0.75)
            ):
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
                exit_reason = f"Opposing Signal Reversal ({decision.get('direction').upper()} @ {decision.get('confidence', 0.0):.0%})"

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
                upstream_outputs = pos.get("upstream_outputs", {})

                # Dynamically construct full execution flow steps across ALL nodes in the DAG
                steps = []
                step_idx = 1
                for node_id, out in upstream_outputs.items():
                    if not isinstance(out, dict):
                        continue
                    out_type = out.get("type", "")
                    if out_type == "MarketData":
                        layer = "data"
                        node_name = "Orderbook Depth Feed" if ("imbalancePct" in out or "orderbook" in str(node_id).lower()) else "OHLCV Price Feed"
                        computation = f"Ingested real-time market data for {out.get('symbol', symbol)}."
                    elif out_type == "NewsFeed":
                        layer = "data"
                        node_name = "Live News & Narrative Stream"
                        computation = f"Ingested {out.get('articleCount', 0)} articles (sentiment score {out.get('sentimentScore', 0.0):+.2f})."
                    elif out_type == "FeatureVector":
                        layer = "features"
                        node_name = "Market Regime Tagger" if ("regime" in str(node_id).lower() or "regime-tagger" in str(node_id).lower()) else "Technical Indicators"
                        computation = f"Computed technical indicators: RSI={out.get('rsi', 0.0):.1f}, Fast EMA=${out.get('ema_fast', 0.0):,.2f}, Regime={out.get('regime', 'Normal')}."
                    elif out_type == "Signal":
                        if "gbdt" in str(node_id).lower() or "forecast" in str(node_id).lower():
                            layer = "ml"
                            node_name = "GBDT Gradient Boosting Forecast"
                        elif "contrarian" in str(node_id).lower():
                            layer = "agents"
                            node_name = "Contrarian Trap Detector"
                        elif "flow" in str(node_id).lower():
                            layer = "agents"
                            node_name = "Order Flow Imbalance Agent"
                        elif "sentiment" in str(node_id).lower():
                            layer = "agents"
                            node_name = "Market Sentiment Agent"
                        elif "agreement" in str(node_id).lower() or "consensus" in str(node_id).lower():
                            layer = "agents"
                            node_name = "Multi-Agent Consensus (Agreement Score)"
                        else:
                            layer = "agents"
                            node_name = out.get("agentName") or out.get("triggerNode") or "Technical Analyst Agent"
                        computation = out.get("rationale") or f"Signal direction: {out.get('direction', 'neutral').upper()} with {int(float(out.get('confidence', 0.5))*100)}% conviction."
                    elif out_type == "RiskDecision":
                        layer = "risk"
                        node_name = "Institutional Risk Gate"
                        computation = out.get("reason") or "Verified risk limits, drawdown envelope, and computed position sizing."
                    else:
                        layer = "logic"
                        node_name = str(node_id)
                        computation = f"Executed node computation for {node_id}."

                    steps.append({
                        "stepIndex": step_idx,
                        "layer": layer,
                        "nodeId": str(node_id),
                        "nodeName": node_name,
                        "status": "completed",
                        "input": out.get("audit", {}).get("input_features") or out.get("inputs_received") or {},
                        "computation": computation,
                        "output": out,
                    })
                    step_idx += 1

                # If upstream_outputs was empty (legacy fallback), construct core steps
                if not steps:
                    steps = [
                        {
                            "stepIndex": 1,
                            "layer": "data",
                            "nodeId": "ohlcv-feed",
                            "nodeName": "OHLCV Price Feed",
                            "status": "completed",
                            "input": {"symbol": symbol, "timestamp": str(pos.get("entry_time"))},
                            "computation": f"Ingested candle bar for {symbol}.",
                            "output": entry_candle or {"close": entry_price},
                        },
                        {
                            "stepIndex": 2,
                            "layer": "features",
                            "nodeId": "ta-indicators",
                            "nodeName": "Technical Indicators",
                            "status": "completed",
                            "input": {"priceClose": entry_price},
                            "computation": f"Calculated technical features for {symbol}.",
                            "output": entry_features or {},
                        },
                        {
                            "stepIndex": 3,
                            "layer": "agents",
                            "nodeId": "technical-agent",
                            "nodeName": "Technical Analyst",
                            "status": "completed",
                            "input": {"features": entry_features},
                            "computation": entry_signal.get("rationale", "Directional momentum evaluated."),
                            "output": entry_signal or {"direction": pos["side"], "confidence": pos.get("confidence", 0.75)},
                        },
                        {
                            "stepIndex": 4,
                            "layer": "risk",
                            "nodeId": "risk-gate",
                            "nodeName": "Institutional Risk Gate",
                            "status": "completed",
                            "input": {"signal": pos["side"], "confidence": pos.get("confidence", 0.75)},
                            "computation": entry_risk.get("reason", "Approved allocation limits."),
                            "output": entry_risk or {"approved": True, "stopPrice": pos.get("stop_price")},
                        },
                    ]
                    step_idx = 5

                # Append execution broker step
                steps.append({
                    "stepIndex": step_idx,
                    "layer": "execution",
                    "nodeId": "paper-executor",
                    "nodeName": "Paper Execution Broker",
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
                        "size": round(size, 4),
                        "grossPnl": round(gross_pnl, 2),
                        "netPnl": round(net_pnl, 2),
                        "pnlPct": round(pnl_pct, 2),
                        "feesPaid": round(fee_cost, 2),
                        "exitReason": exit_reason,
                        "status": "CLOSED",
                    },
                })

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
                    "steps": steps,
                }

                entry_sig = pos.get("entry_signal", {})
                trigger_name = entry_sig.get("agentName") or entry_sig.get("triggerNode") or entry_sig.get("trigger_node") or "Multi-Agent Consensus"

                closed_trade = ClosedTrade(
                    id=execution_flow["tradeId"],
                    symbol=symbol,
                    side=pos["side"],
                    entry_time=pos["entry_time"],
                    exit_time=open_time,
                    size=round(size, 4),
                    pnl=round(net_pnl, 2),
                    pnl_pct=round(pnl_pct, 2),
                    trigger_node=trigger_name,
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
                    entry_time=open_time.isoformat() if hasattr(open_time, "isoformat") else str(open_time),
                    stop_price=decision.get("stopPrice"),
                    confidence=decision.get("confidence", 0.75),
                    target_price=decision.get("targetPrice"),
                )
                # Store audit trail context in position
                portfolio.position["entry_candle"] = candle_snapshot
                portfolio.position["entry_features"] = features_data
                portfolio.position["entry_signal"] = signal_data
                portfolio.position["entry_risk"] = decision
                try:
                    from ...engine.live_runner import make_json_serializable
                    portfolio.position["upstream_outputs"] = make_json_serializable(getattr(ctx, "upstream_outputs", {}))
                except Exception:
                    pass

                if hasattr(ctx, "bot_id") and ctx.bot_id and getattr(ctx, "mode", "historical") == "live":
                    from ...engine.live_runner import append_bot_log
                    append_bot_log(str(ctx.bot_id), "fill", f"ORDER FILLED: {side.upper()} {order_qty:,.4f} units @ ${executed_price:,.2f}")

        return closed_trade
