"""
GBDT Forecast Inference Node — Phase 19 / Multi-Horizon
========================================================

A real, trained LightGBM-based directional forecast node with Multi-Horizon support.

Design decisions (do not relitigate):
- NO LLM involvement. This is pure statistical inference, not reasoning.
- NO credit deduction. Cost to the user is effectively free compute — this is the
  deliberate, stated distinction between Layer III (LLM-optional reasoning, credit-metered)
  and Layer IV (deterministic statistical inference, free).
- NO mode gating. A trained GBDT model is sub-millisecond at inference — there is no cost
  reason to skip it in historical/walk-forward/monte-carlo modes.
  gbdt-forecast runs its real trained model in EVERY mode, always.
- Lazy, cached model loading. Loading LightGBM boosters from disk happens on first run(),
  caching the primary booster on self._model and all companion horizon boosters
  (e.g. 12, 24, 32 bars) in self._horizon_models.
- Multi-Horizon Forecasting: Evaluates probabilities P(up), P(flat), P(down) across all
  trained horizons (e.g. 12, 24, 32 bars forward), computing horizon confluence and trend alignment.
- Dual-path model registry lookup:
    - If ctx.ml_model_registry_cache is populated: use it (fast, DB-free, for historical backtests)
    - If ctx.db is not None: query ml_models directly (for paper/live modes)
    - If neither: return "no model" fallback gracefully

Feature encoding convention — MUST match train_gbdt_forecast.py exactly:
  regime_numeric: 1.0 = "Trend" (|ema_fast - ema_slow| > close * 0.01)
                  0.0 = "Chop"  (|ema_fast - ema_slow| <= close * 0.01)
  label decode:   0 = "down" → "short"
                  1 = "flat" → "flat"
                  2 = "up"   → "long"
"""

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from ..base import NodeContext

# Registry cache key format: f"{component_id}:{symbol}:{resolution}"
_CACHE_KEY_FMT = "{component_id}:{symbol}:{resolution}"

# Feature extraction fast-path: candle dict field names set by backtest_runner.prepare_indicators_dataframe()
_PRECOMPUTED_FIELDS = {
    "rsi": "_rsi",
    "ema_fast": "_ema_fast",
    "ema_slow": "_ema_slow",
    "macd": "_macd",
    "macd_signal": "_macd_signal",
}

# Regime encoding — MUST match train_gbdt_forecast.REGIME_TREND / REGIME_CHOP
_REGIME_TREND = 1.0
_REGIME_CHOP = 0.0

# Label decode map — MUST match train_gbdt_forecast.LABEL_MAP_INV then mapped to Signal directions
# {0: "down"→"short", 1: "flat"→"flat", 2: "up"→"long"}
_LABEL_TO_DIRECTION = {0: "short", 1: "flat", 2: "long"}


def _regime_to_numeric(ema_fast: float, ema_slow: float, close: float) -> float:
    """
    Compute regime as a float for the GBDT feature vector.
    """
    return _REGIME_TREND if abs(ema_fast - ema_slow) > close * 0.01 else _REGIME_CHOP


def _zscore(close: float, ema_fast: float, ema_slow: float) -> float:
    """
    Compute zscore for the GBDT feature vector.
    """
    return (close - ema_slow) / (abs(ema_fast - ema_slow) + 1.0)


def _compute_alignment(horizons_dict: Dict[str, Dict[str, Any]]) -> str:
    """
    Compute multi-horizon consensus / alignment.
    """
    if not horizons_dict:
        return "neutral"

    directions = [h["direction"] for h in horizons_dict.values()]
    n = len(directions)
    longs = directions.count("long")
    shorts = directions.count("short")
    flats = directions.count("flat")

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


class GbdtForecastNode:
    """
    Layer IV: GBDT Forecast — Real trained LightGBM directional classifier with Multi-Horizon support.

    Produces Signal with P(up)/P(down)/P(flat) probabilities across 12, 24, and 32-bar horizons
    and full audit trail. Runs in all modes: historical, walk-forward, monte-carlo, paper, live.
    No LLM, no credits, no gateway.
    """

    component_id = "gbdt-forecast"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._model = None                     # Primary lightgbm.Booster instance
        self._horizon_models: Dict[int, Any] = {}  # {12: booster_12, 24: booster_24, 32: booster_32}
        self._model_row = None                 # MlModelModel instance (or dict from cache)
        self._load_error: Optional[str] = None
        self._load_attempted = False

    # ------------------------------------------------------------------
    # Model loading helpers
    # ------------------------------------------------------------------

    def _load_model_from_row(self, row: Any) -> None:
        """
        Load the LightGBM booster from disk given a model registry row.
        Also discovers companion horizon models (_h12.txt, _h24.txt, _h32.txt).
        """
        try:
            import lightgbm as lgb
        except ImportError:
            self._load_error = (
                "lightgbm is not installed. Run: pip install lightgbm"
            )
            return

        if isinstance(row, dict):
            artifact_path = row.get("artifact_path", "")
            row_symbol = row.get("symbol", "")
            row_resolution = row.get("resolution", "")
            primary_horizon = int(row.get("horizon_bars", 12))
        else:
            artifact_path = getattr(row, "artifact_path", "")
            row_symbol = getattr(row, "symbol", "")
            row_resolution = getattr(row, "resolution", "")
            primary_horizon = int(getattr(row, "horizon_bars", 12))

        if not artifact_path or not os.path.exists(artifact_path):
            self._load_error = (
                f"Model artifact not found at '{artifact_path}'. "
                f"Run: python -m app.ml.train_gbdt_forecast "
                f"--symbol {row_symbol} --resolution {row_resolution}"
            )
            return

        try:
            # 1. Load primary model
            self._model = lgb.Booster(model_file=artifact_path)
            self._model_row = row
            self._horizon_models = {primary_horizon: self._model}

            # 2. Discover companion horizon artifacts in the same folder
            art_file = Path(artifact_path)
            parent_dir = art_file.parent
            base_stem = art_file.stem
            # Strip trailing _h<digits> if artifact_path was already a specific horizon file
            base_prefix = re.sub(r"_h\d+$", "", base_stem)

            # Look for all matching {base_prefix}_h*.txt files
            for companion in parent_dir.glob(f"{base_prefix}_h*.txt"):
                match = re.search(r"_h(\d+)\.txt$", companion.name)
                if match:
                    h_val = int(match.group(1))
                    try:
                        self._horizon_models[h_val] = lgb.Booster(model_file=str(companion))
                    except Exception as he:
                        pass

        except Exception as e:
            self._load_error = f"Failed to load LightGBM model from '{artifact_path}': {e}"

    async def _try_load(self, ctx: NodeContext, symbol: str, resolution: str) -> None:
        """
        Attempt to find and load the active model for (symbol, resolution).
        """
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
                    f"No active ml_model found in backtest cache for {cache_key}. "
                    f"Ensure an active model row exists for gbdt-forecast/{symbol}/{resolution} "
                    f"or run: python -m app.ml.train_gbdt_forecast --symbol {symbol} --resolution {resolution}"
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
    # Feature vector construction
    # ------------------------------------------------------------------

    def _extract_candle_features(self, candle: Any) -> Optional[Dict[str, float]]:
        """
        Extract base OHLCV-derived features from the current candle.
        """
        if isinstance(candle, dict):
            close = float(candle.get("close", 1.0))
            has_precomputed = "_rsi" in candle
            rsi = float(candle.get("_rsi", candle.get("rsi", 50.0))) if has_precomputed else 50.0
            ema_fast = float(candle.get("_ema_fast", candle.get("ema_fast", close)))
            ema_slow = float(candle.get("_ema_slow", candle.get("ema_slow", close)))
            macd = float(candle.get("_macd", candle.get("macd", 0.0)))
            macd_signal = float(candle.get("_macd_signal", candle.get("macd_signal", 0.0)))
        else:
            close = float(getattr(candle, "close", 1.0))
            has_precomputed = hasattr(candle, "_rsi")
            rsi = float(getattr(candle, "_rsi", getattr(candle, "rsi", 50.0))) if has_precomputed else 50.0
            ema_fast = float(getattr(candle, "_ema_fast", getattr(candle, "ema_fast", close)))
            ema_slow = float(getattr(candle, "_ema_slow", getattr(candle, "ema_slow", close)))
            macd = float(getattr(candle, "_macd", getattr(candle, "macd", 0.0)))
            macd_signal = float(getattr(candle, "_macd_signal", getattr(candle, "macd_signal", 0.0)))

        if close <= 0:
            close = 1.0

        return {
            "rsi": rsi,
            "ema_fast": ema_fast,
            "ema_slow": ema_slow,
            "macd": macd,
            "macd_signal": macd_signal,
            "zscore": _zscore(close, ema_fast, ema_slow),
            "regime_numeric": _regime_to_numeric(ema_fast, ema_slow, close),
            "_close": close,
        }

    def _extract_optional_features(self, ctx: NodeContext) -> Dict[str, float]:
        """
        Extract optional upstream features (sentiment, imbalance) if available.
        """
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

        vector = []
        missing = []
        for col in feature_columns:
            if col in all_features:
                vector.append(float(all_features[col]))
            else:
                missing.append(col)

        if missing:
            self._load_error = (
                f"Feature mismatch: model expects columns {missing} but they are not available "
                f"in the current graph. Available features: {list(all_features.keys())}"
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
        """
        Run real Multi-Horizon GBDT inference for one bar.
        """
        cfg = {**self.config, **config}
        min_confidence = float(cfg.get("minConfidence", 0.4))
        require_confluence = bool(cfg.get("requireHorizonConfluence", False))

        candle = ctx.candle
        if isinstance(candle, dict):
            current_close = float(candle.get("close", 1.0))
            symbol = str(candle.get("symbol", cfg.get("symbol", "BTCUSDT")))
        else:
            current_close = float(getattr(candle, "close", 1.0))
            symbol = str(getattr(candle, "symbol", cfg.get("symbol", "BTCUSDT")))

        if current_close <= 0:
            current_close = 1.0

        resolution = str(cfg.get("resolution", "15m"))

        # Lazy model load
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
        base_features = self._extract_candle_features(candle)
        optional_features = self._extract_optional_features(ctx)

        if isinstance(self._model_row, dict):
            feature_columns = list(self._model_row.get("feature_columns", []))
            version = self._model_row.get("version", "unknown")
            primary_horizon = int(self._model_row.get("horizon_bars", 12))
            row_symbol = self._model_row.get("symbol", symbol)
            row_resolution = self._model_row.get("resolution", resolution)
            accuracy = self._model_row.get("accuracy")
        else:
            feature_columns = list(self._model_row.feature_columns or [])
            version = getattr(self._model_row, "version", "unknown")
            primary_horizon = int(getattr(self._model_row, "horizon_bars", 12))
            row_symbol = getattr(self._model_row, "symbol", symbol)
            row_resolution = getattr(self._model_row, "resolution", resolution)
            accuracy = getattr(self._model_row, "accuracy", None)

        prior_load_error = self._load_error
        self._load_error = None
        feature_vector = self._build_feature_vector(base_features, optional_features, feature_columns)

        if feature_vector is None:
            rationale = self._load_error or "Feature vector construction failed"
            self._load_error = prior_load_error
            return self._fallback_output(current_close, "feature_mismatch", rationale)

        # Multi-Horizon LightGBM inference
        horizons_out: Dict[str, Dict[str, Any]] = {}
        primary_probs = None
        primary_direction = "flat"
        primary_confidence = 0.0

        try:
            for h_val, booster in sorted(self._horizon_models.items()):
                probs_matrix = booster.predict([feature_vector])
                probs = probs_matrix[0]  # [P(down), P(flat), P(up)]

                dir_idx = int(probs.argmax())
                dir_str = _LABEL_TO_DIRECTION[dir_idx]
                conf = float(probs[dir_idx])

                horizons_out[f"{h_val}_bars"] = {
                    "horizon": h_val,
                    "p_down": round(float(probs[0]), 4),
                    "p_flat": round(float(probs[1]), 4),
                    "p_up": round(float(probs[2]), 4),
                    "direction": dir_str,
                    "confidence": round(conf, 4),
                }

                if h_val == primary_horizon or primary_probs is None:
                    primary_probs = probs
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

        alignment = _compute_alignment(horizons_out)

        # Apply minConfidence
        direction = primary_direction
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
            f"GBDT forecast ({version}): "
            + " ".join(horizon_summaries)
            + f" [{alignment}]"
        )
        if confidence < min_confidence:
            rationale += f" [flattened: confidence {confidence:.2f} < minConfidence {min_confidence:.2f}]"
        elif require_confluence and direction == "flat" and primary_direction != "flat":
            rationale += f" [flattened: lacked horizon confluence]"

        return {
            "type": "Signal",
            "direction": direction,
            "confidence": round(confidence, 4),
            "price": current_close,
            "rationale": rationale,
            "audit": {
                "model_version": version,
                "model_symbol": row_symbol,
                "model_resolution": row_resolution,
                "horizon_bars": primary_horizon,
                "train_accuracy": float(accuracy) if accuracy is not None else None,
                "probabilities": {
                    "down": round(float(primary_probs[0]), 4),
                    "flat": round(float(primary_probs[1]), 4),
                    "up": round(float(primary_probs[2]), 4),
                },
                "horizons": horizons_out,
                "alignment": alignment,
                "feature_vector": dict(
                    zip(feature_columns, [round(float(v), 4) for v in feature_vector])
                ),
                "min_confidence_applied": min_confidence,
                "require_horizon_confluence": require_confluence,
            },
        }
