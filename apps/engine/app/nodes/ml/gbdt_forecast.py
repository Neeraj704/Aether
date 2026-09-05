"""
GBDT Forecast Inference Node — Phase 19.1 (Correction Pass)
============================================================

A real, trained LightGBM-based directional forecast node with Multi-Horizon support.

Phase 19.1 corrections (do not relitigate):
- Live/paper mode fix: _extract_candle_features() now has a proper rolling-window computation
  path for when ctx.historical_window is present. Previously the live-mode path silently
  fell back to degenerate constants (rsi=50, ema_fast=ema_slow=close, macd=0) every single
  tick. That is now fixed.
- 19-feature set: ATR, BB width, volume z-score, ROC×3, lag returns×3, hour/day — computed
  from ctx.historical_window in live mode, from precomputed backtest candle fields in backtest mode.
- Feature columns in DEFAULT_FEATURE_COLUMNS (defined here) MUST be kept in exact lockstep
  with train_gbdt_forecast.DEFAULT_FEATURE_COLUMNS. If you add a feature to one, add it to both.

Design decisions (do not relitigate):
- NO LLM. NO credit deduction. NO mode gating. This runs real inference in every mode.
- Lazy, cached model loading on first run().
- Dual-path model registry lookup: cache (backtests) → DB (paper/live) → fallback gracefully.
- Minimum window rows for live-mode feature computation: 50 (enough for EMA-50 convergence).
  Fewer than 50 → insufficient_window fallback (not a crash).
"""

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..base import NodeContext

# Registry cache key format: f"{component_id}:{symbol}:{resolution}"
_CACHE_KEY_FMT = "{component_id}:{symbol}:{resolution}"

# Regime encoding — MUST match train_gbdt_forecast constants
_REGIME_TREND = 1.0
_REGIME_CHOP  = 0.0

# Label decode: {0: down, 1: flat, 2: up} → Signal directions
_LABEL_TO_DIRECTION = {0: "short", 1: "flat", 2: "long"}

# 19 feature columns — MUST match train_gbdt_forecast.DEFAULT_FEATURE_COLUMNS exactly.
# Order is non-negotiable: LightGBM loads features positionally.
DEFAULT_FEATURE_COLUMNS = [
    "rsi",
    "ema_fast",
    "ema_slow",
    "macd",
    "macd_signal",
    "zscore",
    "regime_numeric",
    "atr_14",
    "atr_pct",
    "bb_width",
    "volume_zscore",
    "roc_5",
    "roc_10",
    "roc_20",
    "ret_lag_1",
    "ret_lag_2",
    "ret_lag_3",
    "hour_of_day",
    "day_of_week",
]

# Minimum number of historical bars needed for meaningful feature computation in live mode.
# EMA-50 needs ~150 bars to converge, ATR-14 needs 14. We require 50 as a pragmatic minimum
# that gives reasonable values for all indicators including EMA-slow.
_MIN_WINDOW_ROWS = 50


# ---------------------------------------------------------------------------
# Feature computation helpers
# ---------------------------------------------------------------------------

def _compute_features_from_window(window_df: Any, candle: Any) -> Optional[Dict[str, float]]:
    """
    Compute all 19 features from a rolling historical window DataFrame.
    Used in live/paper mode when ctx.historical_window is present.

    MUST produce numerically equivalent results to train_gbdt_forecast.compute_features_vectorized()
    for the same rows. The vectorized training function is authoritative; this replicates it
    for a single bar (the last bar in the window).

    Args:
        window_df: pd.DataFrame with columns at minimum: close, (optionally high, low, volume, open_time)
        candle: the current candle (dict or object) — used only for fallback symbol/close value

    Returns:
        Dict of 19 features, or None if window is too short.
    """
    try:
        import pandas as pd
        import numpy as np
    except ImportError:
        return None

    if window_df is None:
        return None

    # Normalize to DataFrame
    if not hasattr(window_df, "iloc"):
        return None

    if len(window_df) < _MIN_WINDOW_ROWS:
        return None

    close = window_df["close"].astype(float)
    volume = window_df.get("volume", pd.Series(1.0, index=window_df.index)).astype(float).replace(0, 1.0) \
        if hasattr(window_df, "get") else pd.Series(1.0, index=window_df.index)
    high = window_df["high"].astype(float) if "high" in window_df.columns else close
    low  = window_df["low"].astype(float)  if "low"  in window_df.columns else close

    # --- RSI(14) ---
    delta   = close.diff()
    gain    = delta.clip(lower=0)
    loss    = -delta.clip(upper=0)
    avg_g   = gain.rolling(window=14, min_periods=1).mean()
    avg_l   = loss.rolling(window=14, min_periods=1).mean()
    rs      = avg_g / avg_l.replace(0, float("nan"))
    rsi_s   = (100 - (100 / (1 + rs))).fillna(50.0)

    # --- EMA fast (20) and slow (50) ---
    ema_fast_s = close.ewm(span=20, adjust=False).mean()
    ema_slow_s = close.ewm(span=50, adjust=False).mean()

    # --- MACD (12, 26, 9) ---
    ema12        = close.ewm(span=12, adjust=False).mean()
    ema26        = close.ewm(span=26, adjust=False).mean()
    macd_series  = ema12 - ema26
    macd_sig_s   = macd_series.ewm(span=9, adjust=False).mean()

    # --- zscore and regime ---
    ema_spread   = (ema_fast_s - ema_slow_s).abs() + 1.0
    zscore_s     = (close - ema_slow_s) / ema_spread
    regime_s     = ((ema_fast_s - ema_slow_s).abs() > close * 0.01).astype(float)

    # --- ATR(14) ---
    prev_close   = close.shift(1)
    tr           = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    atr_s        = tr.rolling(window=14, min_periods=1).mean()
    atr_pct_s    = atr_s / close.replace(0, float("nan"))

    # --- Bollinger Band width (20 period) ---
    bb_mid       = close.rolling(window=20, min_periods=1).mean()
    bb_std       = close.rolling(window=20, min_periods=1).std(ddof=0).fillna(0)
    bb_range     = (bb_mid + 2 * bb_std) - (bb_mid - 2 * bb_std)
    bb_width_s   = (bb_range / bb_mid.replace(0, float("nan"))).fillna(0)

    # --- Volume z-score (20 period) ---
    vol_mean     = volume.rolling(window=20, min_periods=1).mean()
    vol_std      = volume.rolling(window=20, min_periods=1).std(ddof=0).fillna(1.0).replace(0, 1.0)
    vol_zs       = (volume - vol_mean) / vol_std

    # --- Rate of Change ---
    roc_5_s      = close.pct_change(5).fillna(0)
    roc_10_s     = close.pct_change(10).fillna(0)
    roc_20_s     = close.pct_change(20).fillna(0)

    # --- Lag returns ---
    ret          = close.pct_change(1).fillna(0)
    ret_lag1_s   = ret.shift(1).fillna(0)
    ret_lag2_s   = ret.shift(2).fillna(0)
    ret_lag3_s   = ret.shift(3).fillna(0)

    # --- Time features from open_time column ---
    if "open_time" in window_df.columns:
        ot = window_df["open_time"].iloc[-1]
        hour_of_day = float(ot.hour) if hasattr(ot, "hour") else 0.0
        day_of_week = float(ot.weekday()) if hasattr(ot, "weekday") else 0.0
    else:
        hour_of_day = 0.0
        day_of_week = 0.0

    # Extract the LAST row values (the current bar)
    return {
        "rsi":           float(rsi_s.iloc[-1]),
        "ema_fast":      float(ema_fast_s.iloc[-1]),
        "ema_slow":      float(ema_slow_s.iloc[-1]),
        "macd":          float(macd_series.iloc[-1]),
        "macd_signal":   float(macd_sig_s.iloc[-1]),
        "zscore":        float(zscore_s.iloc[-1]),
        "regime_numeric": float(regime_s.iloc[-1]),
        "atr_14":        float(atr_s.iloc[-1]),
        "atr_pct":       float(atr_pct_s.iloc[-1]) if not _is_nan(atr_pct_s.iloc[-1]) else 0.0,
        "bb_width":      float(bb_width_s.iloc[-1]) if not _is_nan(bb_width_s.iloc[-1]) else 0.0,
        "volume_zscore": float(vol_zs.iloc[-1]),
        "roc_5":         float(roc_5_s.iloc[-1]),
        "roc_10":        float(roc_10_s.iloc[-1]),
        "roc_20":        float(roc_20_s.iloc[-1]),
        "ret_lag_1":     float(ret_lag1_s.iloc[-1]),
        "ret_lag_2":     float(ret_lag2_s.iloc[-1]),
        "ret_lag_3":     float(ret_lag3_s.iloc[-1]),
        "hour_of_day":   hour_of_day,
        "day_of_week":   day_of_week,
    }


def _is_nan(v: Any) -> bool:
    try:
        import math
        return math.isnan(float(v))
    except Exception:
        return False


def _extract_from_precomputed(candle: Any) -> Optional[Dict[str, float]]:
    """
    Backtest fast-path: read precomputed indicator fields from the candle dict/object.
    These are set by backtest_runner.prepare_indicators_dataframe() before the bar loop.
    Falls back to raw OHLCV-derived values if precomputed fields are absent.
    """
    if isinstance(candle, dict):
        close      = float(candle.get("close", 1.0))
        if close <= 0:
            close = 1.0
        rsi        = float(candle.get("_rsi",        candle.get("rsi",          50.0)))
        ema_fast   = float(candle.get("_ema_fast",   candle.get("ema_fast",     close)))
        ema_slow   = float(candle.get("_ema_slow",   candle.get("ema_slow",     close)))
        macd       = float(candle.get("_macd",       candle.get("macd",         0.0)))
        macd_sig   = float(candle.get("_macd_signal", candle.get("macd_signal", 0.0)))
        atr_14     = float(candle.get("_atr_14",     candle.get("atr_14",       0.0)))
        atr_pct    = float(candle.get("_atr_pct",    candle.get("atr_pct",      0.0)))
        bb_width   = float(candle.get("_bb_width",   candle.get("bb_width",     0.0)))
        vol_zs     = float(candle.get("_volume_zscore", candle.get("volume_zscore", 0.0)))
        roc_5      = float(candle.get("_roc_5",      candle.get("roc_5",        0.0)))
        roc_10     = float(candle.get("_roc_10",     candle.get("roc_10",       0.0)))
        roc_20     = float(candle.get("_roc_20",     candle.get("roc_20",       0.0)))
        ret_lag1   = float(candle.get("_ret_lag_1",  candle.get("ret_lag_1",    0.0)))
        ret_lag2   = float(candle.get("_ret_lag_2",  candle.get("ret_lag_2",    0.0)))
        ret_lag3   = float(candle.get("_ret_lag_3",  candle.get("ret_lag_3",    0.0)))
        # Time fields — may be absent from precomputed backtest candles
        ot = candle.get("open_time")
        hour_of_day = float(ot.hour) if hasattr(ot, "hour") else float(candle.get("_hour_of_day", 0.0))
        day_of_week = float(ot.weekday()) if hasattr(ot, "weekday") else float(candle.get("_day_of_week", 0.0))
    else:
        close      = float(getattr(candle, "close", 1.0))
        if close <= 0:
            close = 1.0
        rsi        = float(getattr(candle, "_rsi",        getattr(candle, "rsi",          50.0)))
        ema_fast   = float(getattr(candle, "_ema_fast",   getattr(candle, "ema_fast",     close)))
        ema_slow   = float(getattr(candle, "_ema_slow",   getattr(candle, "ema_slow",     close)))
        macd       = float(getattr(candle, "_macd",       getattr(candle, "macd",         0.0)))
        macd_sig   = float(getattr(candle, "_macd_signal", getattr(candle, "macd_signal", 0.0)))
        atr_14     = float(getattr(candle, "_atr_14",     getattr(candle, "atr_14",       0.0)))
        atr_pct    = float(getattr(candle, "_atr_pct",    getattr(candle, "atr_pct",      0.0)))
        bb_width   = float(getattr(candle, "_bb_width",   getattr(candle, "bb_width",     0.0)))
        vol_zs     = float(getattr(candle, "_volume_zscore", getattr(candle, "volume_zscore", 0.0)))
        roc_5      = float(getattr(candle, "_roc_5",      getattr(candle, "roc_5",        0.0)))
        roc_10     = float(getattr(candle, "_roc_10",     getattr(candle, "roc_10",       0.0)))
        roc_20     = float(getattr(candle, "_roc_20",     getattr(candle, "roc_20",       0.0)))
        ret_lag1   = float(getattr(candle, "_ret_lag_1",  getattr(candle, "ret_lag_1",    0.0)))
        ret_lag2   = float(getattr(candle, "_ret_lag_2",  getattr(candle, "ret_lag_2",    0.0)))
        ret_lag3   = float(getattr(candle, "_ret_lag_3",  getattr(candle, "ret_lag_3",    0.0)))
        ot = getattr(candle, "open_time", None)
        hour_of_day = float(ot.hour) if hasattr(ot, "hour") else 0.0
        day_of_week = float(ot.weekday()) if hasattr(ot, "weekday") else 0.0

    ema_spread = abs(ema_fast - ema_slow) + 1.0
    zscore = (close - ema_slow) / ema_spread
    regime = _REGIME_TREND if abs(ema_fast - ema_slow) > close * 0.01 else _REGIME_CHOP

    return {
        "rsi":            rsi,
        "ema_fast":       ema_fast,
        "ema_slow":       ema_slow,
        "macd":           macd,
        "macd_signal":    macd_sig,
        "zscore":         zscore,
        "regime_numeric": regime,
        "atr_14":         atr_14,
        "atr_pct":        atr_pct,
        "bb_width":       bb_width,
        "volume_zscore":  vol_zs,
        "roc_5":          roc_5,
        "roc_10":         roc_10,
        "roc_20":         roc_20,
        "ret_lag_1":      ret_lag1,
        "ret_lag_2":      ret_lag2,
        "ret_lag_3":      ret_lag3,
        "hour_of_day":    hour_of_day,
        "day_of_week":    day_of_week,
        "_close":         close,
    }


def _compute_alignment(horizons_dict: Dict[str, Dict[str, Any]]) -> str:
    if not horizons_dict:
        return "neutral"
    directions = [h["direction"] for h in horizons_dict.values()]
    n = len(directions)
    longs  = directions.count("long")
    shorts = directions.count("short")
    flats  = directions.count("flat")

    if longs == n:
        return "strong_bullish"
    elif shorts == n:
        return "strong_bearish"
    elif longs > shorts and longs >= n / 2:
        return "moderate_bullish"
    elif shorts > longs and shorts >= n / 2:
        return "moderate_bearish"
    elif flats == n:
        return "neutral"
    else:
        return "mixed"


def _compute_edge_tier(mcc: float, is_discriminative: bool, is_calibrated: bool) -> str:
    """
    Combines edge magnitude (MCC) with calibration/discrimination status into one
    honest, user-facing label. Magnitude alone is not sufficient — a model with MCC=0.06
    but non-discriminative confidence must not be labeled the same as a model with MCC=0.06
    and well-calibrated confidence, because the former's confidence NUMBER cannot be trusted
    even though its DIRECTIONAL edge might be real.
    """
    if mcc <= 0.0:
        return "none"
    if not is_discriminative:
        # Directional edge (MCC) may be real, but confidence is not usable as a probability.
        magnitude = "marginal" if mcc <= 0.05 else ("weak" if mcc <= 0.15 else "moderate")
        return f"{magnitude}_uncalibratable"
    magnitude = "marginal" if mcc <= 0.05 else ("weak" if mcc <= 0.15 else ("moderate" if mcc <= 0.30 else "strong"))
    calib_suffix = "calibrated" if is_calibrated else "uncalibrated"
    return f"{magnitude}_{calib_suffix}"


class GbdtForecastNode:
    """
    Layer IV: GBDT Forecast — Real trained LightGBM directional classifier with Multi-Horizon support.

    Produces Signal with P(up)/P(down)/P(flat) probabilities across 12, 24, and 32-bar horizons
    and full audit trail. Runs in all modes: historical, walk-forward, monte-carlo, paper, live.
    No LLM, no credits, no gateway.

    Phase 19.1: Live-mode feature bug fixed. In live/paper mode, features are now computed from
    ctx.historical_window using the same rolling-window math as training.

    Phase 19.2: Discrimination-check aware, dedicated-split isotonic calibration support,
    and honest edge_tiering. If a model is non-discriminative, minConfidence gating is bypassed
    (to prevent arbitrary noise filtering) and tagged as unreliable in audit.
    """

    component_id = "gbdt-forecast"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._model = None                          # Primary lightgbm.Booster
        self._horizon_models: Dict[int, Any] = {}  # {12: booster, 24: booster, 32: booster}
        self._model_row = None                      # MlModelModel instance (or dict from cache)
        self._calibration_wrapper = None            # CalibratedClassifierCV wrapper (if discriminative & calibrated)
        self._is_discriminative = False
        self._calibration_path: Optional[str] = None
        self._cv_mcc_mean = 0.0
        self._test_mcc = 0.0
        self._load_error: Optional[str] = None
        self._load_attempted = False

    # ------------------------------------------------------------------
    # Model loading helpers
    # ------------------------------------------------------------------

    def _load_model_from_row(self, row: Any) -> None:
        """
        Load the LightGBM booster from disk given a model registry row.
        Also discovers companion horizon models (_h12.txt, _h24.txt, _h32.txt)
        and optional calibration wrapper artifact (.calib.joblib).
        """
        try:
            import lightgbm as lgb
        except ImportError:
            self._load_error = "lightgbm is not installed. Run: pip install lightgbm"
            return

        if isinstance(row, dict):
            artifact_path   = row.get("artifact_path", "")
            row_symbol      = row.get("symbol", "")
            row_resolution  = row.get("resolution", "")
            primary_horizon = int(row.get("horizon_bars", 12))
            is_disc         = bool(row.get("is_discriminative", False))
            calib_path      = row.get("calibration_path")
            cv_mcc          = float(row.get("cv_mcc_mean", 0.0) or 0.0)
            t_mcc           = float(row.get("test_mcc", 0.0) or 0.0)
            feat_cols       = list(row.get("feature_columns") or [])
            row_ver         = str(row.get("version", "unknown"))
            row_acc         = row.get("accuracy")
        else:
            artifact_path   = str(getattr(row, "artifact_path", "") or "")
            row_symbol      = str(getattr(row, "symbol", "") or "")
            row_resolution  = str(getattr(row, "resolution", "") or "")
            primary_horizon = int(getattr(row, "horizon_bars", 12))
            is_disc         = bool(getattr(row, "is_discriminative", False))
            calib_path      = getattr(row, "calibration_path", None)
            cv_mcc          = float(getattr(row, "cv_mcc_mean", 0.0) or 0.0)
            t_mcc           = float(getattr(row, "test_mcc", 0.0) or 0.0)
            feat_cols       = list(getattr(row, "feature_columns", None) or [])
            row_ver         = str(getattr(row, "version", "unknown") or "unknown")
            row_acc         = getattr(row, "accuracy", None)

        self._model_data = {
            "artifact_path": artifact_path,
            "symbol": row_symbol,
            "resolution": row_resolution,
            "horizon_bars": primary_horizon,
            "is_discriminative": is_disc,
            "calibration_path": calib_path,
            "cv_mcc_mean": cv_mcc,
            "test_mcc": t_mcc,
            "feature_columns": feat_cols,
            "version": row_ver,
            "accuracy": row_acc,
        }

        self._is_discriminative = is_disc
        self._calibration_path  = calib_path
        self._cv_mcc_mean       = cv_mcc
        self._test_mcc          = t_mcc

        if not artifact_path or not os.path.exists(artifact_path):
            self._load_error = (
                f"Model artifact not found at '{artifact_path}'. "
                f"Run: python -m app.ml.train_gbdt_forecast "
                f"--symbol {row_symbol} --resolution {row_resolution}"
            )
            return

        try:
            self._model = lgb.Booster(model_file=artifact_path)
            self._model_row = row
            self._horizon_models = {primary_horizon: self._model}

            # Discover companion horizon artifacts in the same folder
            art_file    = Path(artifact_path)
            parent_dir  = art_file.parent
            base_prefix = re.sub(r"_h\d+$", "", art_file.stem)

            for companion in parent_dir.glob(f"{base_prefix}_h*.txt"):
                match = re.search(r"_h(\d+)\.txt$", companion.name)
                if match:
                    h_val = int(match.group(1))
                    try:
                        self._horizon_models[h_val] = lgb.Booster(model_file=str(companion))
                    except Exception:
                        pass  # Best-effort: missing companion horizon is non-fatal

            # Lazy load calibration wrapper if present
            if calib_path and os.path.exists(calib_path):
                try:
                    import joblib
                    self._calibration_wrapper = joblib.load(calib_path)
                except Exception as e:
                    self._calibration_wrapper = None
            else:
                self._calibration_wrapper = None

        except Exception as e:
            self._load_error = f"Failed to load LightGBM model from '{artifact_path}': {e}"


    async def _try_load(self, ctx: NodeContext, symbol: str, resolution: str) -> None:
        """Attempt to find and load the active model for (symbol, resolution)."""
        cache_key = _CACHE_KEY_FMT.format(
            component_id=self.component_id,
            symbol=symbol.upper(),
            resolution=resolution,
        )

        # Path 1: In-memory registry cache (populated upfront in backtests)
        if ctx.ml_model_registry_cache is not None:
            cached_row = ctx.ml_model_registry_cache.get(cache_key)
            if cached_row is not None:
                self._load_model_from_row(cached_row)
                return
            else:
                self._load_error = (
                    f"No active ml_model in backtest cache for {cache_key}. "
                    f"Run: python -m app.ml.train_gbdt_forecast --symbol {symbol} --resolution {resolution}"
                )
                return

        # Path 2: Direct DB query (for paper/live runs)
        if ctx.db is not None:
            try:
                from sqlalchemy import select
                from ...db.models import MlModelModel

                result = await ctx.db.execute(
                    select(MlModelModel).where(
                        MlModelModel.component_id == self.component_id,
                        MlModelModel.symbol == symbol.upper(),
                        MlModelModel.resolution == resolution,
                        MlModelModel.is_active == True,
                    ).order_by(MlModelModel.created_at.desc()).limit(1)
                )
                row = result.scalars().first()
                if row is not None:
                    self._load_model_from_row(row)
                    return
                else:
                    self._load_error = (
                        f"No active ml_models row in DB for {self.component_id}/{symbol}/{resolution}. "
                        f"Run: python -m app.ml.train_gbdt_forecast --symbol {symbol} --resolution {resolution}"
                    )
                    return
            except Exception as e:
                self._load_error = f"DB lookup failed for ml_models: {e}"
                return

        # Path 3: Neither cache nor DB
        self._load_error = (
            f"No model registry source available for gbdt-forecast/{symbol}/{resolution} "
            f"(ctx.ml_model_registry_cache is None and ctx.db is None)."
        )

    # ------------------------------------------------------------------
    # Feature extraction — two paths (Phase 19.1 fix)
    # ------------------------------------------------------------------

    def _extract_candle_features(
        self, candle: Any, ctx: NodeContext
    ) -> Optional[Dict[str, float]]:
        """
        Extract the 19-feature vector for one bar.

        Path A — Backtest mode: candle has precomputed _rsi/_ema_fast/etc. fields.
          Detected by presence of '_rsi' or '_ema_fast' key/attribute.

        Path B — Live/paper mode: ctx.historical_window is a rolling DataFrame of recent
          OHLCV bars. Rolling-window indicator math is applied to the whole window and the
          last row's values are taken as the current bar's features.
          Returns None if window is absent or has fewer than _MIN_WINDOW_ROWS rows.
          This results in an 'insufficient_window' fallback (not a crash).

        The two paths produce numerically equivalent values for the same bars.
        """
        # Check if precomputed fields are present (backtest fast-path)
        if isinstance(candle, dict):
            has_precomputed = "_rsi" in candle or "_ema_fast" in candle
        else:
            has_precomputed = hasattr(candle, "_rsi") or hasattr(candle, "_ema_fast")

        if has_precomputed:
            # Path A: Backtest — precomputed fields on the candle
            return _extract_from_precomputed(candle)

        # Path B: Live/paper mode — compute from ctx.historical_window
        window = getattr(ctx, "historical_window", None)
        if window is None or (hasattr(window, "__len__") and len(window) < _MIN_WINDOW_ROWS):
            return None  # → insufficient_window fallback

        features = _compute_features_from_window(window, candle)
        if features is not None:
            # Attach _close for run() to use
            if isinstance(candle, dict):
                features["_close"] = float(candle.get("close", 1.0))
            else:
                features["_close"] = float(getattr(candle, "close", 1.0))
        return features

    def _extract_optional_features(self, ctx: NodeContext) -> Dict[str, float]:
        """Extract optional upstream features (sentiment, imbalance) if available."""
        optional = {}
        upstream = ctx.upstream_outputs or {}

        for output in upstream.values():
            if not isinstance(output, dict):
                continue
            out_type = output.get("type", "")
            if out_type == "NewsFeed" and "sentimentScore" in output:
                optional["sentimentScore"] = float(output["sentimentScore"])
            if out_type == "MarketData" and "imbalancePct" in output:
                optional["imbalancePct"] = float(output["imbalancePct"])

        return optional

    def _build_feature_vector(
        self,
        base_features: Dict[str, float],
        optional_features: Dict[str, float],
        feature_columns: List[str],
    ) -> Optional[List[float]]:
        """
        Build the model input feature vector in the EXACT order specified by feature_columns.
        """
        all_features = {**base_features, **optional_features}
        all_features.pop("_close", None)

        vector  = []
        missing = []
        for col in feature_columns:
            if col in all_features:
                vector.append(float(all_features[col]))
            else:
                missing.append(col)

        if missing:
            self._load_error = (
                f"Feature mismatch: model expects columns {missing} but they are not available. "
                f"Available: {list(all_features.keys())}. "
                f"This usually means the model was trained with a different feature set — retrain."
            )
            return None

        return vector

    # ------------------------------------------------------------------
    # Fallback output helpers
    # ------------------------------------------------------------------

    def _fallback_output(
        self,
        current_close: float,
        model_status: str,
        rationale: str,
    ) -> Dict[str, Any]:
        return {
            "type": "Signal",
            "direction": "flat",
            "confidence": 0.0,
            "price": current_close,
            "rationale": rationale,
            "audit": {
                "model_status": model_status,
                "component_id": "gbdt-forecast",
                "rationale": rationale,
            },
        }

    # ------------------------------------------------------------------
    # Main run()
    # ------------------------------------------------------------------

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        """Run real Multi-Horizon GBDT inference for one bar."""
        cfg = {**self.config, **config}
        min_confidence   = float(cfg.get("minConfidence", 0.4))
        require_confluence = bool(cfg.get("requireHorizonConfluence", False))

        candle = ctx.candle
        if isinstance(candle, dict):
            current_close = float(candle.get("close", 1.0))
            symbol        = str(candle.get("symbol", cfg.get("symbol", "BTCUSDT")))
        else:
            current_close = float(getattr(candle, "close", 1.0))
            symbol        = str(getattr(candle, "symbol", cfg.get("symbol", "BTCUSDT")))

        if current_close <= 0:
            current_close = 1.0

        resolution = str(cfg.get("resolution", "15m"))

        # Lazy model load (once per node instance)
        if not self._load_attempted:
            self._load_attempted = True
            await self._try_load(ctx, symbol, resolution)

        # "No model" fallback
        if self._model is None or self._model_row is None:
            rationale = self._load_error or (
                f"No trained gbdt-forecast model found for {symbol}/{resolution} — "
                f"run: python -m app.ml.train_gbdt_forecast --symbol {symbol} --resolution {resolution}"
            )
            return self._fallback_output(current_close, "not_found", rationale)

        # Build feature vector
        base_features = self._extract_candle_features(candle, ctx)

        if base_features is None:
            # Live/paper mode with insufficient historical window
            window = getattr(ctx, "historical_window", None)
            window_len = len(window) if window is not None and hasattr(window, "__len__") else 0
            rationale = (
                f"Insufficient historical window for {symbol}/{resolution}: "
                f"{window_len} bars available, need ≥{_MIN_WINDOW_ROWS}. "
                f"Returning flat signal — will improve as window fills."
            )
            return self._fallback_output(current_close, "insufficient_window", rationale)

        optional_features = self._extract_optional_features(ctx)

        m_data = getattr(self, "_model_data", {})
        feature_columns = list(m_data.get("feature_columns") or [])
        version         = str(m_data.get("version", "unknown"))
        primary_horizon = int(m_data.get("horizon_bars", 12))
        row_symbol      = str(m_data.get("symbol", symbol))
        row_resolution  = str(m_data.get("resolution", resolution))
        accuracy        = m_data.get("accuracy")

        # Fall back to the 7-column set if the model was trained pre-19.1 (feature_columns has 7 items)
        if not feature_columns:
            feature_columns = DEFAULT_FEATURE_COLUMNS

        prior_load_error = self._load_error
        self._load_error = None
        feature_vector = self._build_feature_vector(base_features, optional_features, feature_columns)

        if feature_vector is None:
            rationale = self._load_error or "Feature vector construction failed"
            self._load_error = prior_load_error
            return self._fallback_output(current_close, "feature_mismatch", rationale)

        # Multi-Horizon LightGBM inference
        horizons_out: Dict[str, Dict[str, Any]] = {}
        primary_probs     = None
        primary_direction = "flat"
        primary_confidence = 0.0

        try:
            for h_val, booster in sorted(self._horizon_models.items()):
                probs_matrix = booster.predict([feature_vector])
                probs        = probs_matrix[0]  # [P(down), P(flat), P(up)]

                dir_idx = int(probs.argmax())
                dir_str = _LABEL_TO_DIRECTION[dir_idx]
                conf    = float(probs[dir_idx])

                horizons_out[f"{h_val}_bars"] = {
                    "horizon":    h_val,
                    "p_down":     round(float(probs[0]), 4),
                    "p_flat":     round(float(probs[1]), 4),
                    "p_up":       round(float(probs[2]), 4),
                    "direction":  dir_str,
                    "confidence": round(conf, 4),
                }

                if h_val == primary_horizon or primary_probs is None:
                    primary_probs     = probs
                    primary_direction = dir_str
                    primary_confidence = conf

        except Exception as e:
            return self._fallback_output(
                current_close,
                "inference_error",
                f"GbdtForecastNode inference failed: {e}",
            )

        if primary_probs is None:
            primary_probs = [0.33, 0.34, 0.33]

        # --------------------------------------------------------------
        # Phase 19.2: Apply Calibration if available and discriminative
        # --------------------------------------------------------------
        is_calibrated = False
        if self._is_discriminative and self._calibration_wrapper is not None:
            try:
                calib_matrix = self._calibration_wrapper.predict_proba([feature_vector])
                calib_probs = calib_matrix[0]
                primary_probs = calib_probs
                dir_idx = int(calib_probs.argmax())
                primary_direction = _LABEL_TO_DIRECTION[dir_idx]
                primary_confidence = float(calib_probs[dir_idx])
                is_calibrated = True

                # Update primary horizon entry with calibrated values
                if f"{primary_horizon}_bars" in horizons_out:
                    horizons_out[f"{primary_horizon}_bars"]["p_down"] = round(float(calib_probs[0]), 4)
                    horizons_out[f"{primary_horizon}_bars"]["p_flat"] = round(float(calib_probs[1]), 4)
                    horizons_out[f"{primary_horizon}_bars"]["p_up"] = round(float(calib_probs[2]), 4)
                    horizons_out[f"{primary_horizon}_bars"]["direction"] = primary_direction
                    horizons_out[f"{primary_horizon}_bars"]["confidence"] = round(primary_confidence, 4)
            except Exception:
                is_calibrated = False

        alignment = _compute_alignment(horizons_out)

        # --------------------------------------------------------------
        # Phase 19.2: Edge tier and Discrimination-aware minConfidence Gate
        # --------------------------------------------------------------
        edge_mcc = self._test_mcc if self._test_mcc > 0 else self._cv_mcc_mean
        edge_tier = _compute_edge_tier(edge_mcc, self._is_discriminative, is_calibrated)

        if not self._is_discriminative:
            # Non-discriminative model: confidence has no proven relationship to correctness.
            # Bypassing minConfidence gate (filtering on noise degrades signal without filtering for quality).
            confidence_reliability = "unreliable_do_not_gate_or_size_on_this"
            min_confidence_applied = 0.0
            direction = primary_direction
            confidence = primary_confidence
        else:
            confidence_reliability = "calibrated" if is_calibrated else "uncalibrated_discriminative"
            min_confidence_applied = min_confidence
            direction  = primary_direction
            confidence = primary_confidence
            if confidence < min_confidence and direction != "flat":
                direction = "flat"

        # Apply optional Horizon Confluence requirement
        if require_confluence and direction != "flat":
            concurring = sum(1 for h in horizons_out.values() if h["direction"] == direction)
            if concurring < max(2, len(horizons_out) // 2 + 1):
                direction = "flat"

        # Rationale string
        horizon_summaries = [
            f"H{h_data['horizon']}={h_data['direction']}({h_data['confidence']:.0%})"
            for h_data in horizons_out.values()
        ]
        rationale = (
            f"GBDT forecast ({version}) [{edge_tier}]: "
            + " ".join(horizon_summaries)
            + f" [{alignment}]"
        )
        if not self._is_discriminative:
            rationale += (
                f" [Model shows directional edge (MCC={edge_mcc:.3f}) but confidence is not discriminative "
                f"— do not use confidence to size positions or filter trades; minConfidence bypassed]"
            )
        elif confidence < min_confidence:
            rationale += f" [flattened: confidence {confidence:.2f} < minConfidence {min_confidence:.2f}]"
        elif require_confluence and direction == "flat" and primary_direction != "flat":
            rationale += f" [flattened: lacked horizon confluence]"

        return {
            "type":       "Signal",
            "direction":  direction,
            "confidence": round(confidence, 4),
            "price":      current_close,
            "rationale":  rationale,
            "audit": {
                "model_version":              version,
                "model_symbol":               row_symbol,
                "model_resolution":           row_resolution,
                "horizon_bars":               primary_horizon,
                "train_accuracy":             float(accuracy) if accuracy is not None else None,
                "edge_tier":                  edge_tier,
                "confidence_reliability":     confidence_reliability,
                "is_discriminative":          self._is_discriminative,
                "is_calibrated":              is_calibrated,
                "cv_mcc_mean":                self._cv_mcc_mean,
                "test_mcc":                   self._test_mcc,
                "probabilities": {
                    "down": round(float(primary_probs[0]), 4),
                    "flat": round(float(primary_probs[1]), 4),
                    "up":   round(float(primary_probs[2]), 4),
                },
                "horizons":                   horizons_out,
                "alignment":                  alignment,
                "feature_vector":             dict(
                    zip(feature_columns, [round(float(v), 4) for v in feature_vector])
                ),
                "min_confidence_applied":     min_confidence_applied,
                "require_horizon_confluence": require_confluence,
            },
        }

