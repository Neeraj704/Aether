from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..base import NodeContext
from ...data.macro_blackout import compute_blackout

def _normalize_dt(dt: Any) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    if not isinstance(dt, datetime):
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

class MacroCalendarNode:
    """
    Macro Calendar Node.
    Monitors scheduled high-impact US macro events (FOMC, CPI, NFP) to trigger
    event blackout windows for capital preservation.
    """
    component_id = "macro-calendar"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        cfg = {**self.config, **config}

        candle = ctx.candle
        if isinstance(candle, dict):
            symbol = str(candle.get("symbol") or cfg.get("symbol") or "BTCUSDT")
            candle_time = candle.get("open_time")
        else:
            symbol = str(getattr(candle, "symbol", None) or cfg.get("symbol") or "BTCUSDT")
            candle_time = getattr(candle, "open_time", None)

        if ctx.mode in ("paper", "live") and not candle_time:
            ref_time = datetime.now(timezone.utc)
        elif candle_time:
            ref_time = _normalize_dt(candle_time)
        else:
            ref_time = datetime.now(timezone.utc)

        blackout_active, blackout_reason = await compute_blackout(
            reference_time=ref_time,
            db=ctx.db,
            macro_events_cache=ctx.macro_events_cache,
        )

        return {
            "type": "NewsFeed",
            "symbol": symbol,
            "timestamp": ref_time.isoformat(),
            "sentimentScore": 0.0,
            "articleCount": 0,
            "blackoutActive": blackout_active,
            "blackoutReason": blackout_reason,
        }
