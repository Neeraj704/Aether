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
        
        # Look for upstream Signal
        signal = None
        for out in ctx.upstream_outputs.values():
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
        confidence = signal.get("confidence", 0.5)

        # Risk parameters from component fields in layers.ts
        max_pos_pct = float(cfg.get("maxPosition", 20.0))  # e.g. 20% equity
        threshold = float(cfg.get("threshold", 65.0))      # min risk score threshold

        # Portfolio equity
        equity = ctx.portfolio.equity if ctx.portfolio else 100000.0
        allocated_capital = equity * (max_pos_pct / 100.0)
        sized_qty = allocated_capital / current_close

        # Dynamic stop loss (e.g. 2.5% against position direction)
        stop_loss_pct = 0.025
        if direction == "long":
            stop_price = current_close * (1.0 - stop_loss_pct)
        else:
            stop_price = current_close * (1.0 + stop_loss_pct)

        # Risk gate decision
        required_threshold = (threshold / 100.0 * 0.8) # Normalized threshold
        approved = confidence >= required_threshold

        return {
            "type": "RiskDecision",
            "approved": approved,
            "direction": direction,
            "sizedQuantity": sized_qty if approved else 0.0,
            "stopPrice": stop_price,
            "confidence": confidence,
            "reason": (
                f"Approved: Signal confidence ({confidence:.0%}) meets threshold ({threshold:.0f}%). "
                f"Sized {max_pos_pct:.1f}% equity (₹{allocated_capital:,.2f}) with stop @ ₹{stop_price:,.2f}."
                if approved
                else f"Vetoed: Signal confidence ({confidence:.0%}) below risk gate requirement ({threshold:.0f}%)."
            ),
            "audit": {
                "portfolio_equity": round(equity, 2),
                "max_position_pct": max_pos_pct,
                "allocated_capital": round(allocated_capital, 2),
                "calculated_quantity": round(sized_qty, 4),
                "stop_loss_pct": stop_loss_pct * 100.0,
                "stop_price": round(stop_price, 2) if stop_price else None,
                "confidence_threshold": threshold,
                "approved": approved,
            }
        }
