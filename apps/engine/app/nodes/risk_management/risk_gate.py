from typing import Any, Dict
from ..base import NodeContext

class RiskGateNode:
    component_id = "risk-gate"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates signals against portfolio limits, computes position sizing and stop loss.
        Emits a RiskDecision.
        """
        cfg = {**self.config, **config}
        
        # Collect upstream Signal in reverse topological order (respecting consensus/calibration layers)
        signal = None
        for out in reversed(list(ctx.upstream_outputs.values())):
            if isinstance(out, dict) and out.get("type") == "Signal":
                signal = out
                break

        candle = ctx.candle
        if isinstance(candle, dict):
            current_close = float(candle.get("close", 1.0))
        else:
            current_close = float(getattr(candle, "close", 1.0))

        if current_close <= 0:
            current_close = 1.0

        if not signal or signal.get("direction") == "flat":
            return {
                "type": "RiskDecision",
                "approved": False,
                "direction": "flat",
                "sizedQuantity": 0.0,
                "stopPrice": None,
                "confidence": 0.0,
                "reason": "Flat signal or no signal provided",
            }

        direction = signal["direction"]
        confidence = float(signal.get("confidence", 0.5))

        # Risk parameters from component fields in layers.ts
        max_pos_pct = float(cfg.get("maxPosition", 20.0))  # e.g. 20% equity
        threshold = float(cfg.get("threshold", 65.0))      # min risk score threshold (e.g. 65%)

        # Portfolio equity
        equity = ctx.portfolio.equity if ctx.portfolio else 100000.0
        allocated_capital = equity * (max_pos_pct / 100.0)
        sized_qty = allocated_capital / current_close

        # Dynamic stop loss and take profit
        stop_loss_pct = float(cfg.get("stopLossPct", 2.0)) / 100.0
        rr_ratio = float(cfg.get("riskRewardRatio", 2.5))
        take_profit_pct = stop_loss_pct * rr_ratio

        if direction == "long":
            stop_price = current_close * (1.0 - stop_loss_pct)
            target_price = current_close * (1.0 + take_profit_pct)
        else:
            stop_price = current_close * (1.0 + stop_loss_pct)
            target_price = current_close * (1.0 - take_profit_pct)

        # Risk gate decision: Signal confidence must meet or exceed the configured threshold (unless confidence is marked unreliable)
        signal_audit = signal.get("audit") if isinstance(signal.get("audit"), dict) else {}
        is_unreliable_conf = signal_audit.get("confidence_reliability") == "unreliable_do_not_gate_or_size_on_this"

        required_threshold = threshold / 100.0
        approved = (direction in ("long", "short")) and (confidence >= required_threshold or is_unreliable_conf)

        return {
            "type": "RiskDecision",
            "approved": approved,
            "direction": direction,
            "sizedQuantity": sized_qty if approved else 0.0,
            "stopPrice": stop_price,
            "targetPrice": target_price,
            "confidence": confidence,
            "reason": (
                f"Approved: Signal confidence ({confidence:.0%}) meets threshold ({threshold:.0f}%). "
                f"Sized {max_pos_pct:.1f}% equity (₹{allocated_capital:,.2f}) with stop @ ₹{stop_price:,.2f}, TP @ ₹{target_price:,.2f}."
                if (approved and not is_unreliable_conf)
                else (
                    f"Approved: Directional signal verified (unreliable confidence bypass). "
                    f"Sized {max_pos_pct:.1f}% equity (₹{allocated_capital:,.2f}) with stop @ ₹{stop_price:,.2f}, TP @ ₹{target_price:,.2f}."
                    if approved
                    else f"Vetoed: Signal confidence ({confidence:.0%}) below risk gate requirement ({threshold:.0f}%)."
                )
            ),

            "audit": {
                "portfolio_equity": round(equity, 2),
                "max_position_pct": max_pos_pct,
                "allocated_capital": round(allocated_capital, 2),
                "calculated_quantity": round(sized_qty, 4),
                "stop_loss_pct": stop_loss_pct * 100.0,
                "take_profit_pct": take_profit_pct * 100.0,
                "stop_price": round(stop_price, 2) if stop_price else None,
                "target_price": round(target_price, 2) if target_price else None,
                "confidence_threshold": threshold,
                "approved": approved,
            }
        }
