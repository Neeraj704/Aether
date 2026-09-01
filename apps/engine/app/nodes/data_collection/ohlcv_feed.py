from typing import Any, Dict
from ..base import NodeContext

class OhlcvFeedNode:
    component_id = "ohlcv-feed"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Emits MarketData output containing current candle and rolling DataFrame window.
        """
        c = ctx.candle
        if isinstance(c, dict):
            return {
                "type": "MarketData",
                "symbol": c.get("symbol", "BTCUSDT"),
                "open_time": c.get("open_time"),
                "open": float(c.get("open", 0.0)),
                "high": float(c.get("high", 0.0)),
                "low": float(c.get("low", 0.0)),
                "close": float(c.get("close", 0.0)),
                "volume": float(c.get("volume", 0.0)),
                "window": ctx.historical_window,
            }
        return {
            "type": "MarketData",
            "symbol": getattr(c, "symbol", "BTCUSDT"),
            "open_time": getattr(c, "open_time", None),
            "open": float(getattr(c, "open", 0.0)),
            "high": float(getattr(c, "high", 0.0)),
            "low": float(getattr(c, "low", 0.0)),
            "close": float(getattr(c, "close", 0.0)),
            "volume": float(getattr(c, "volume", 0.0)),
            "window": ctx.historical_window,
        }
