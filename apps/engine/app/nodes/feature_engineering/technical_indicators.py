from typing import Any, Dict
import pandas as pd
import numpy as np
from ..base import NodeContext

class TechnicalIndicatorsNode:
    component_id = "ta-indicators"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes RSI, EMA fast/slow, and MACD on rolling window.
        Returns a FeatureVector.
        """
        cfg = {**self.config, **config}
        rsi_period = int(cfg.get("rsiPeriod", 14))
        ema_fast_len = int(cfg.get("macdFast", 20))
        ema_slow_len = int(cfg.get("macdSlow", 50))

        df = ctx.historical_window
        current_close = float(getattr(ctx.candle, "close", 0.0))

        # 1. Fast O(1) check if indicators were precomputed in vectorized pass
        c = ctx.candle
        if isinstance(c, dict) and "_rsi" in c:
            return {
                "type": "FeatureVector",
                "rsi": float(c.get("_rsi", 50.0)),
                "ema_fast": float(c.get("_ema_fast", current_close)),
                "ema_slow": float(c.get("_ema_slow", current_close)),
                "macd": float(c.get("_macd", 0.0)),
                "macd_signal": float(c.get("_macd_signal", 0.0)),
                "close": current_close,
            }
        elif hasattr(c, "_rsi"):
            return {
                "type": "FeatureVector",
                "rsi": float(getattr(c, "_rsi", 50.0)),
                "ema_fast": float(getattr(c, "_ema_fast", current_close)),
                "ema_slow": float(getattr(c, "_ema_slow", current_close)),
                "macd": float(getattr(c, "_macd", 0.0)),
                "macd_signal": float(getattr(c, "_macd_signal", 0.0)),
                "close": current_close,
            }

        # 2. Fallback to rolling calculation if not precomputed
        if df is None or len(df) < max(rsi_period, ema_slow_len, 26):
            return {
                "type": "FeatureVector",
                "rsi": 50.0,
                "ema_fast": current_close,
                "ema_slow": current_close,
                "macd": 0.0,
                "macd_signal": 0.0,
                "close": current_close,
            }

        try:
            close_series = df["close"].astype(float)
            
            # RSI calculation
            delta = close_series.diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            
            avg_gain = gain.rolling(window=rsi_period, min_periods=1).mean()
            avg_loss = loss.rolling(window=rsi_period, min_periods=1).mean()
            
            rs = avg_gain / avg_loss.replace(0, np.nan)
            rsi_series = 100 - (100 / (1 + rs))
            rsi_series = rsi_series.fillna(50.0)
            rsi_val = float(rsi_series.iloc[-1])

            # EMAs
            ema_fast = close_series.ewm(span=ema_fast_len, adjust=False).mean()
            ema_slow = close_series.ewm(span=ema_slow_len, adjust=False).mean()
            fast_val = float(ema_fast.iloc[-1])
            slow_val = float(ema_slow.iloc[-1])

            # MACD
            ema12 = close_series.ewm(span=12, adjust=False).mean()
            ema26 = close_series.ewm(span=26, adjust=False).mean()
            macd_series = ema12 - ema26
            signal_series = macd_series.ewm(span=9, adjust=False).mean()
            
            macd_val = float(macd_series.iloc[-1])
            signal_val = float(signal_series.iloc[-1])

            return {
                "type": "FeatureVector",
                "rsi": rsi_val,
                "ema_fast": fast_val,
                "ema_slow": slow_val,
                "macd": macd_val,
                "macd_signal": signal_val,
                "close": current_close,
            }
        except Exception:
            return {
                "type": "FeatureVector",
                "rsi": 50.0,
                "ema_fast": current_close,
                "ema_slow": current_close,
                "macd": 0.0,
                "macd_signal": 0.0,
                "close": current_close,
            }
