from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..base import NodeContext
from ...data.orderbook_snapshot import fetch_orderbook_snapshot, compute_imbalance

def _extract_candle_fields(candle: Any) -> tuple[float, float, float, float, float, str, Any]:
    if isinstance(candle, dict):
        c_open = float(candle.get("open", 1.0))
        c_high = float(candle.get("high", c_open))
        c_low = float(candle.get("low", c_open))
        c_close = float(candle.get("close", c_open))
        c_vol = float(candle.get("volume", 100.0))
        symbol = str(candle.get("symbol", "BTCUSDT"))
        open_time = candle.get("open_time")
    else:
        c_open = float(getattr(candle, "open", 1.0))
        c_high = float(getattr(candle, "high", c_open))
        c_low = float(getattr(candle, "low", c_open))
        c_close = float(getattr(candle, "close", c_open))
        c_vol = float(getattr(candle, "volume", 100.0))
        symbol = str(getattr(candle, "symbol", "BTCUSDT"))
        open_time = getattr(candle, "open_time", None)

    return c_open, c_high, c_low, c_close, c_vol, symbol, open_time

class OrderbookDepthNode:
    """
    Order Book Depth Node (Layer I: Data Collection).
    In paper/live mode: queries live Binance Level 2 depth and computes real volume imbalance.
    In historical/backtest mode: computes an intra-bar OHLCV proxy with explicit 'proxy_from_ohlcv' tagging.
    """
    component_id = "orderbook-depth"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        cfg = {**self.config, **config}
        depth_levels = int(cfg.get("levels", 10))

        c_open, c_high, c_low, c_close, c_vol, candle_symbol, open_time = _extract_candle_fields(ctx.candle)
        target_symbol = str(cfg.get("symbol") or candle_symbol)

        # 1. Live / Paper Mode: Try real Binance L2 depth fetch
        if ctx.mode in ("paper", "live"):
            snapshot = await fetch_orderbook_snapshot(target_symbol, limit=depth_levels * 2)
            if snapshot and (snapshot.get("bids") or snapshot.get("asks")):
                imbalance = compute_imbalance(snapshot["bids"], snapshot["asks"], depth_levels=depth_levels)
                fetched_at = snapshot.get("fetched_at", datetime.now(timezone.utc))
                return {
                    "type": "MarketData",
                    "symbol": target_symbol,
                    "timestamp": fetched_at.isoformat(),
                    "depthLevels": depth_levels,
                    "bidVolume": imbalance["bidVolume"],
                    "askVolume": imbalance["askVolume"],
                    "imbalanceRatio": imbalance["imbalanceRatio"],
                    "imbalancePct": imbalance["imbalancePct"],
                    "dataQuality": "real_orderbook",
                }

        # 2. Historical / Walk-forward / Monte-carlo Mode (or live fallback):
        # Compute intra-bar directional proxy from OHLCV candle shape
        spread = max(0.0001, c_high - c_low)
        delta_pct = (c_close - c_open) / spread
        delta_pct = max(-1.0, min(1.0, delta_pct))

        # Split candle volume into estimated buy vs sell flow
        buy_factor = 0.5 + 0.5 * delta_pct
        sell_factor = 1.0 - buy_factor

        bid_vol = round(c_vol * buy_factor, 4)
        ask_vol = round(c_vol * sell_factor, 4)
        imbalance_ratio = round(bid_vol / max(ask_vol, 1e-9), 4)
        imbalance_pct = round(delta_pct, 4)

        ref_time = open_time if open_time else datetime.now(timezone.utc)
        time_str = ref_time.isoformat() if hasattr(ref_time, "isoformat") else str(ref_time)

        return {
            "type": "MarketData",
            "symbol": target_symbol,
            "timestamp": time_str,
            "depthLevels": depth_levels,
            "bidVolume": bid_vol,
            "askVolume": ask_vol,
            "imbalanceRatio": imbalance_ratio,
            "imbalancePct": imbalance_pct,
            "dataQuality": "proxy_from_ohlcv",
        }
