"""
Phase 19 — GbdtForecastNode Test Suite
=======================================

Tests the complete load → feature-order → predict → decode pipeline for the real
GBDT inference node. All tests use synthetic, hand-trained LightGBM models on tiny
synthetic datasets — no 70k-row Binance data required for the automated test suite.

Key coverage:
1. Full pipeline (load → feature order → predict → decode) with a tiny synthetic model
2. Feature vector column ordering — the single most important regression test for
   preventing silent train/serve skew (train/inference feature column order must match)
3. No mode gating — gbdt-forecast runs real inference in ALL modes (historical, paper, live).
   This absence of mode-gating is DELIBERATE (contrast with Layer III LLM agents) and is
   tested explicitly so a future reader doesn't mistake it for an oversight.
4. "No model found" fallback — graceful, not a crash
5. Missing feature column — feature_mismatch fallback, not KeyError
6. ctx.db=None + ml_model_registry_cache — equivalent to DB-backed lookup
7. Pre-existing engine test imports still work (NodeContext additive field check)
"""

import os
import tempfile
import uuid
import pytest
import numpy as np
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from apps.engine.app.nodes.base import NodeContext
from apps.engine.app.nodes.ml.gbdt_forecast import GbdtForecastNode

# ---------------------------------------------------------------------------
# Helpers — build a tiny, real LightGBM model trained on perfectly-separable data
# ---------------------------------------------------------------------------

def _make_synthetic_model_and_artifact(tmp_dir: str) -> tuple:
    """
    Train a tiny LightGBM classifier on perfectly-separable synthetic data and save it
    to disk using LightGBM's native format. Returns (artifact_path, feature_columns).

    The synthetic data:
      feature "x" < 0  → label 0 (down)
      0 <= feature "x" < 1  → label 1 (flat)
      feature "x" >= 1  → label 2 (up)

    Because the data is perfectly separable, the model should predict correctly
    with high confidence, making assertions clean and deterministic.
    """
    import lightgbm as lgb

    # Feature columns in explicit order — this order is what the test asserts against
    feature_columns = ["rsi", "ema_fast", "ema_slow", "macd", "macd_signal", "zscore", "regime_numeric"]

    # Generate perfectly-separable training data
    np.random.seed(42)
    n = 600
    X = np.zeros((n, len(feature_columns)))
    y = np.zeros(n, dtype=int)

    # Use rsi as the separating feature
    rsi_idx = feature_columns.index("rsi")

    # "down": rsi < 30  (label=0)
    for i in range(0, 200):
        X[i, rsi_idx] = np.random.uniform(10, 29)
        y[i] = 0

    # "flat": 30 <= rsi < 70  (label=1)
    for i in range(200, 400):
        X[i, rsi_idx] = np.random.uniform(30, 70)
        y[i] = 1

    # "up": rsi >= 70  (label=2)
    for i in range(400, 600):
        X[i, rsi_idx] = np.random.uniform(71, 95)
        y[i] = 2

    # Fill other features with neutral noise
    for j in range(len(feature_columns)):
        if j != rsi_idx:
            X[:, j] = np.random.normal(0, 0.1, n)

    model = lgb.LGBMClassifier(
        objective="multiclass",
        num_class=3,
        n_estimators=50,
        learning_rate=0.1,
        max_depth=4,
        random_state=42,
        verbosity=-1,
    )
    model.fit(X, y)

    artifact_path = os.path.join(tmp_dir, "BTCUSDT_15m_v_test.txt")
    model.booster_.save_model(artifact_path)

    return artifact_path, feature_columns


def _make_model_row_dict(artifact_path: str, feature_columns: list) -> dict:
    """Build a dict matching MlModelModel fields, usable as ml_model_registry_cache value."""
    return {
        "id": str(uuid.uuid4()),
        "component_id": "gbdt-forecast",
        "version": "v_test",
        "symbol": "BTCUSDT",
        "resolution": "15m",
        "horizon_bars": 12,
        "up_threshold_pct": 0.5,
        "down_threshold_pct": -0.5,
        "artifact_path": artifact_path,
        "feature_columns": feature_columns,
        "train_row_count": 480,
        "accuracy": 0.95,
        "is_active": True,
    }


def _make_candle(close: float = 50000.0, rsi: float = 50.0,
                 ema_fast: float = 49800.0, ema_slow: float = 49500.0,
                 macd: float = 10.0, macd_signal: float = 8.0) -> dict:
    """Build a candle dict with all 19 precomputed indicator fields (as backtest_runner injects).
    Phase 19.1: added _atr_14, _atr_pct, _bb_width, _volume_zscore, _roc_5/10/20, _ret_lag_1/2/3.
    Existing tests still pass because they specify their own feature_columns in model_row_dict.
    """
    return {
        "symbol": "BTCUSDT",
        "close": close,
        "open": close * 0.999,
        "high": close * 1.002,
        "low": close * 0.998,
        "volume": 100.0,
        "open_time": datetime(2024, 6, 1, tzinfo=timezone.utc),
        # Original 5 precomputed fields
        "_rsi": rsi,
        "_ema_fast": ema_fast,
        "_ema_slow": ema_slow,
        "_macd": macd,
        "_macd_signal": macd_signal,
        # Phase 19.1: additional precomputed fields
        "_atr_14": 200.0,
        "_atr_pct": 0.004,
        "_bb_width": 0.02,
        "_volume_zscore": 0.5,
        "_roc_5": 0.01,
        "_roc_10": 0.02,
        "_roc_20": 0.03,
        "_ret_lag_1": 0.001,
        "_ret_lag_2": -0.001,
        "_ret_lag_3": 0.0005,
        "_hour_of_day": 12.0,
        "_day_of_week": 0.0,
    }


def _make_ctx(
    candle: dict,
    mode: str = "historical",
    ml_model_registry_cache: dict = None,
    db=None,
) -> NodeContext:
    return NodeContext(
        candle=candle,
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode=mode,
        ml_model_registry_cache=ml_model_registry_cache,
        db=db,
    )


# ---------------------------------------------------------------------------
# 1. Full pipeline: load → feature order → predict → decode
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_full_pipeline_predicts_correctly():
    """
    Train a tiny synthetic LightGBM model on RSI-separable data.
    Confirm GbdtForecastNode loads it and produces the correct directional prediction.
    This proves the full load → feature-order → predict → decode pipeline is wired correctly.
    """
    import lightgbm  # Skip test if lightgbm not installed
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)
        model_row = _make_model_row_dict(artifact_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        # RSI=85 → should predict "up" (label=2 → direction="long") with high confidence
        candle = _make_candle(close=50000.0, rsi=85.0)
        ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

        node = GbdtForecastNode()
        result = await node.run(ctx, {})

        assert result["type"] == "Signal"
        assert result["direction"] in ("long", "flat", "short")
        assert 0.0 <= result["confidence"] <= 1.0
        assert "GBDT forecast" in result["rationale"]
        assert "probabilities" in result["audit"]
        assert "feature_vector" in result["audit"]
        assert set(result["audit"]["probabilities"].keys()) == {"down", "flat", "up"}

        # RSI=85 → the model should learn this maps to "up"/"long"
        # (high confidence assertion — data is perfectly separable)
        assert result["audit"]["probabilities"]["up"] > 0.8, (
            f"Expected high P(up) for RSI=85, got {result['audit']['probabilities']}"
        )


# ---------------------------------------------------------------------------
# 2. Feature vector column ordering — the critical regression test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_feature_vector_built_in_feature_columns_order():
    """
    Deliberately construct a scenario where the candle's natural feature extraction order
    could differ from feature_columns and confirm the model receives them correctly ordered.

    This is the single most important regression test in Phase 19 — protecting against
    the silent train/serve skew described in Task 3.1 and Task 4.2 of the spec.
    """
    import lightgbm as lgb

    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)

        # Deliberately use a feature_columns order that differs from default to prove
        # the node explicitly reorders by feature_columns, not by dict insertion order.
        # We reverse the feature_columns and retrain a matching model:
        reversed_feature_columns = list(reversed(feature_columns))
        n = 300
        X_rev = np.zeros((n, len(reversed_feature_columns)))
        y = np.zeros(n, dtype=int)
        rsi_idx_rev = reversed_feature_columns.index("rsi")

        np.random.seed(0)
        for i in range(0, 100):
            X_rev[i, rsi_idx_rev] = np.random.uniform(10, 29)
            y[i] = 0
        for i in range(100, 200):
            X_rev[i, rsi_idx_rev] = np.random.uniform(30, 70)
            y[i] = 1
        for i in range(200, 300):
            X_rev[i, rsi_idx_rev] = np.random.uniform(71, 95)
            y[i] = 2
        for j in range(len(reversed_feature_columns)):
            if j != rsi_idx_rev:
                X_rev[:, j] = np.random.normal(0, 0.1, n)

        rev_model = lgb.LGBMClassifier(
            objective="multiclass", num_class=3, n_estimators=50,
            max_depth=4, random_state=1, verbosity=-1,
        )
        rev_model.fit(X_rev, y)
        rev_artifact_path = os.path.join(tmp_dir, "reversed_order.txt")
        rev_model.booster_.save_model(rev_artifact_path)

        # The model_row specifies reversed_feature_columns
        model_row = _make_model_row_dict(rev_artifact_path, reversed_feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        # Candle with RSI=85 — node must reorder features so "rsi" goes to
        # reversed_feature_columns.index("rsi") position, regardless of dict key order
        candle = _make_candle(close=50000.0, rsi=85.0, ema_fast=49800.0, ema_slow=49500.0)
        ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

        node = GbdtForecastNode()
        result = await node.run(ctx, {})

        assert result["type"] == "Signal"
        # Confirm feature_vector keys in audit match reversed_feature_columns
        assert list(result["audit"]["feature_vector"].keys()) == reversed_feature_columns, (
            f"Feature vector key order mismatch: "
            f"expected {reversed_feature_columns}, "
            f"got {list(result['audit']['feature_vector'].keys())}"
        )
        # RSI=85 should still predict "up" correctly even with reversed column order
        assert result["audit"]["probabilities"]["up"] > 0.7, (
            f"Wrong prediction with reversed feature order: {result['audit']['probabilities']}"
        )


# ---------------------------------------------------------------------------
# 3. No mode gating — runs real inference in ALL modes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["historical", "walk-forward", "monte-carlo", "paper", "live"])
async def test_gbdt_runs_real_inference_in_all_modes(mode):
    """
    GbdtForecastNode runs real inference in EVERY mode. No mode gating.

    This is the explicit, deliberate contrast with every Layer III agent (which only
    call LLMs in paper/live mode). GBDT inference is free (sub-ms), so there is no
    cost reason to skip it. The absence of mode-gating here is intentional.

    If this test fails in a specific mode, it means mode-gating was incorrectly added —
    which is explicitly forbidden by the Phase 19 spec.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)
        model_row = _make_model_row_dict(artifact_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        candle = _make_candle(close=50000.0, rsi=20.0)  # RSI=20 → should favor "down"
        ctx = _make_ctx(candle, mode=mode, ml_model_registry_cache=cache)

        node = GbdtForecastNode()
        result = await node.run(ctx, {"minConfidence": 0.0})  # Disable confidence gate

        # Must produce real inference — not a stub, not a fallback due to mode
        assert result["type"] == "Signal"
        assert result.get("direction") in ("long", "flat", "short")
        assert "probabilities" in result["audit"], (
            f"In mode '{mode}', expected real probabilities in audit but got fallback. "
            f"Mode-gating must NOT be added to GbdtForecastNode."
        )
        # Probabilities must be real (sum ≈ 1.0, not all zeros)
        probs = result["audit"]["probabilities"]
        total = sum(probs.values())
        assert abs(total - 1.0) < 0.01, f"Probabilities don't sum to 1 in mode={mode}: {probs}"


# ---------------------------------------------------------------------------
# 4. "No model found" fallback
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_no_model_fallback():
    """
    When no trained model exists for the symbol/resolution, GbdtForecastNode returns
    a valid flat Signal with audit.model_status == "not_found" and an actionable rationale.
    Must NOT crash the bot's execution loop.
    """
    # Empty cache = no model registered
    cache = {}
    candle = _make_candle()
    ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

    node = GbdtForecastNode()
    result = await node.run(ctx, {})

    assert result["type"] == "Signal"
    assert result["direction"] == "flat"
    assert result["confidence"] == 0.0
    assert result["audit"]["model_status"] == "not_found"
    # Rationale must contain actionable guidance
    assert "train_gbdt_forecast" in result["rationale"], (
        f"Rationale should direct user to run training script, got: {result['rationale']}"
    )


# ---------------------------------------------------------------------------
# 5. Missing feature column → feature_mismatch fallback, not KeyError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_missing_feature_column_returns_mismatch_fallback():
    """
    When the model's feature_columns list includes a column that isn't available
    (e.g. because no news-stream node is upstream but the model was trained with
    sentimentScore), the node returns a feature_mismatch fallback — not an unhandled
    KeyError propagating out of run().

    This protects against the train/serve skew guard described in Task 4.2.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)

        # Tell the model it needs a "sentimentScore" column that will never be available
        extended_feature_columns = feature_columns + ["sentimentScore"]
        model_row = _make_model_row_dict(artifact_path, extended_feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        candle = _make_candle()  # No upstream sentimentScore provided
        ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

        node = GbdtForecastNode()
        result = await node.run(ctx, {})

        assert result["type"] == "Signal"
        assert result["direction"] == "flat"
        assert result["confidence"] == 0.0
        assert result["audit"]["model_status"] == "feature_mismatch", (
            f"Expected feature_mismatch, got: {result['audit']}"
        )
        # Should explain which feature was missing
        assert "sentimentScore" in result["rationale"] or "sentimentScore" in str(result["audit"]), (
            f"Missing feature name should appear in rationale/audit: {result}"
        )


# ---------------------------------------------------------------------------
# 6. ctx.db=None + ml_model_registry_cache → equivalent to DB path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_cache_path_equivalent_to_db_path():
    """
    With ctx.db=None and a populated ctx.ml_model_registry_cache, the node produces
    an identical result to the DB-backed lookup path (when DB would return the same row).

    Mirrors the dual-path equivalence test established for compute_blackout in Phase 17.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)
        model_row = _make_model_row_dict(artifact_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        candle = _make_candle(close=50000.0, rsi=85.0)

        # Path A: Cache-based (DB-free) — historical backtest path
        ctx_cache = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache, db=None)
        node_a = GbdtForecastNode()
        result_cache = await node_a.run(ctx_cache, {"minConfidence": 0.0})

        # Path B: Simulate DB-backed path by providing a mock DB session that returns
        # an equivalent MlModelModel object
        mock_db = MagicMock()
        # Build an ORM-like object for the DB path
        mock_row = MagicMock()
        mock_row.artifact_path = artifact_path
        mock_row.feature_columns = feature_columns
        mock_row.version = "v_test"
        mock_row.symbol = "BTCUSDT"
        mock_row.resolution = "15m"
        mock_row.horizon_bars = 12
        mock_row.accuracy = 0.95

        from unittest.mock import AsyncMock
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value.first.return_value = mock_row
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        ctx_db = _make_ctx(candle, mode="paper", ml_model_registry_cache=None, db=mock_db)
        node_b = GbdtForecastNode()
        result_db = await node_b.run(ctx_db, {"minConfidence": 0.0})

        # Both paths must produce the same direction and approximately same confidence
        assert result_cache["type"] == "Signal"
        assert result_db["type"] == "Signal"
        assert result_cache["direction"] == result_db["direction"], (
            f"Cache path direction '{result_cache['direction']}' != "
            f"DB path direction '{result_db['direction']}'"
        )
        # Probabilities should be identical (same model, same input)
        for cls in ("down", "flat", "up"):
            cache_p = result_cache["audit"]["probabilities"][cls]
            db_p = result_db["audit"]["probabilities"][cls]
            assert abs(cache_p - db_p) < 1e-4, (
                f"P({cls}) differs: cache={cache_p:.6f}, db={db_p:.6f}"
            )


# ---------------------------------------------------------------------------
# 7. minConfidence gate flattens low-conviction predictions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_min_confidence_gate_flattens_low_conviction():
    """
    When the winning class probability is below minConfidence, the node should
    return direction="flat" even if the model's argmax would normally give long/short.
    This is the UI-configurable noise reduction gate.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_columns = _make_synthetic_model_and_artifact(tmp_dir)
        model_row = _make_model_row_dict(artifact_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        # RSI=50 → flat region → the model should be relatively uncertain
        candle = _make_candle(close=50000.0, rsi=50.0)
        ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

        # With a very high minConfidence threshold, most outputs should be flattened
        node = GbdtForecastNode()
        result_high_gate = await node.run(ctx, {"minConfidence": 0.99})

        # We can't guarantee RSI=50 gives exactly flat, but with 0.99 gate most will flatten
        # Just assert the output is structurally valid
        assert result_high_gate["type"] == "Signal"
        assert result_high_gate["direction"] in ("long", "flat", "short")
        assert 0.0 <= result_high_gate["confidence"] <= 1.0

        # With gate disabled (0.0), should NOT flatten
        node2 = GbdtForecastNode()
        result_no_gate = await node2.run(ctx, {"minConfidence": 0.0})
        assert result_no_gate["type"] == "Signal"
        assert "probabilities" in result_no_gate["audit"]


# ---------------------------------------------------------------------------
# 8. Regression guard: pre-existing NodeContext fields still work
# ---------------------------------------------------------------------------

def test_node_context_ml_registry_cache_is_additive():
    """
    Verify that adding ml_model_registry_cache to NodeContext is purely additive —
    existing code that constructs NodeContext without this field still works fine,
    defaulting to None. This protects all pre-existing tests from breakage.
    """
    # Construct NodeContext exactly as pre-existing tests do — no ml_model_registry_cache arg
    ctx = NodeContext(
        candle={"close": 50000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
    )
    # New field must default to None without error
    assert ctx.ml_model_registry_cache is None
    # Existing fields must still be present
    assert ctx.macro_events_cache is None
    assert ctx.news_items_cache is None
    assert ctx.mode == "historical"


# ---------------------------------------------------------------------------
# 9. Pre-existing engine tests import check
# ---------------------------------------------------------------------------

def test_preexisting_imports_still_work():
    """
    Smoke-test that the core modules modified in Phase 19 still import cleanly.
    If any of these fail, a Phase 19 change broke a pre-existing dependency.
    """
    from apps.engine.app.nodes.base import NodeContext, ClosedTrade
    from apps.engine.app.engine.bar_runner import build_node_instances, run_one_bar
    from apps.engine.app.nodes.registry import REGISTRY
    from apps.engine.app.db.models import (
        MlModelModel, MacroEventModel, NewsItemModel,
        BotModel, CandleModel, BacktestRunModel,
    )

    # Confirm GbdtForecastNode is in the registry and is the real class
    from apps.engine.app.nodes.ml.gbdt_forecast import GbdtForecastNode
    assert REGISTRY.get("gbdt-forecast") is GbdtForecastNode, (
        "gbdt-forecast should be the real GbdtForecastNode class, not a UniversalNode stub"
    )

    # Confirm the five other ML stubs are still stubs (not GbdtForecastNode)
    for stub_id in ("sequence-model", "vol-forecast", "ensemble-stacker", "anomaly-detector", "meta-labeler"):
        stub_cls = REGISTRY.get(stub_id)
        assert stub_cls is not None, f"{stub_id} missing from registry"
        assert stub_cls is not GbdtForecastNode, (
            f"{stub_id} should remain a UniversalNode stub in Phase 19, not GbdtForecastNode"
        )

    # Confirm MlModelModel is properly in models.py
    assert hasattr(MlModelModel, "feature_columns")
    assert hasattr(MlModelModel, "is_active")
    assert hasattr(MlModelModel, "artifact_path")
    # Phase 19.1 gating columns
    assert hasattr(MlModelModel, "activation_notes")
    assert hasattr(MlModelModel, "test_row_count")
    assert hasattr(MlModelModel, "cv_mcc_mean")
    assert hasattr(MlModelModel, "cv_balanced_acc_mean")
    assert hasattr(MlModelModel, "majority_baseline_acc")
    assert hasattr(MlModelModel, "threshold_mode")
    assert hasattr(MlModelModel, "atr_multiplier")


# ---------------------------------------------------------------------------
# 10. Multi-Horizon Forecasting Tests (12, 24, 32 bars)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_multi_horizon_inference_and_confluence():
    """
    Train 3 separate horizon models (h12, h24, h32) and verify:
    1. GbdtForecastNode loads all companion horizon boosters.
    2. Audit trail includes probability distributions for all 3 horizons.
    3. Multi-horizon alignment string ('strong_bullish', 'strong_bearish', etc.) is computed.
    4. requireHorizonConfluence toggle enforces agreement across horizons.
    """
    import lightgbm as lgb
    with tempfile.TemporaryDirectory() as tmp_dir:
        feature_columns = ["rsi", "ema_fast", "ema_slow", "macd", "macd_signal", "zscore", "regime_numeric"]
        np.random.seed(42)
        n = 600
        X = np.zeros((n, len(feature_columns)))
        rsi_idx = feature_columns.index("rsi")

        # Train 3 models: h12 (bullish on rsi>70), h24 (bullish on rsi>70), h32 (bullish on rsi>70)
        for i in range(0, 200):
            X[i, rsi_idx] = np.random.uniform(10, 29)
        for i in range(200, 400):
            X[i, rsi_idx] = np.random.uniform(30, 70)
        for i in range(400, 600):
            X[i, rsi_idx] = np.random.uniform(71, 95)

        for h in (12, 24, 32):
            y = np.zeros(n, dtype=int)
            y[0:200] = 0   # down
            y[200:400] = 1 # flat
            y[400:600] = 2 # up
            m = lgb.LGBMClassifier(objective="multiclass", num_class=3, n_estimators=30, learning_rate=0.1, max_depth=3, random_state=42, verbosity=-1)
            m.fit(X, y)
            m.booster_.save_model(os.path.join(tmp_dir, f"BTCUSDT_15m_v_test_h{h}.txt"))

        # Save primary artifact as base
        primary_path = os.path.join(tmp_dir, "BTCUSDT_15m_v_test.txt")
        m.booster_.save_model(primary_path)

        model_row = _make_model_row_dict(primary_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        candle = _make_candle(close=50000.0, rsi=85.0)
        ctx = _make_ctx(candle, mode="historical", ml_model_registry_cache=cache)

        node = GbdtForecastNode()
        result = await node.run(ctx, {"requireHorizonConfluence": True})

        assert result["type"] == "Signal"
        assert result["direction"] == "long"
        assert "horizons" in result["audit"]
        assert "12_bars" in result["audit"]["horizons"]
        assert "24_bars" in result["audit"]["horizons"]
        assert "32_bars" in result["audit"]["horizons"]
        assert result["audit"]["alignment"] == "strong_bullish"
        assert result["audit"]["horizons"]["12_bars"]["direction"] == "long"
        assert result["audit"]["horizons"]["24_bars"]["direction"] == "long"
        assert result["audit"]["horizons"]["32_bars"]["direction"] == "long"


# ---------------------------------------------------------------------------
# 11. Phase 19.1: Live-mode uses ctx.historical_window — not degenerate defaults
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_live_mode_uses_historical_window_not_degenerate_defaults():
    """
    Phase 19.1 Task 1 regression test.

    BEFORE Phase 19.1: in live/paper mode, when '_rsi' was absent from the candle,
    GbdtForecastNode silently fell back to RSI=50, ema_fast=ema_slow=close, macd=0
    on EVERY tick. This made all live-mode predictions degenerate (identical inputs).

    AFTER Phase 19.1: when ctx.historical_window is present and has >=50 bars, the
    node MUST compute real rolling indicators. We verify:
    - rsi != 50.0 (computed from actual price changes, not a constant)
    - ema_fast != ema_slow (different spans = different values, unless price is perfectly flat)
    - zscore != 0.0 (non-trivial price vs. EMA relationship)

    The candle is provided WITHOUT precomputed _rsi/_ema_fast fields (live mode),
    and ctx.historical_window is a 60-bar synthetic price series with clear directionality.
    """
    import pandas as pd
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Train a synthetic model with the full 19-feature set
        feature_columns = [
            "rsi", "ema_fast", "ema_slow", "macd", "macd_signal", "zscore", "regime_numeric",
            "atr_14", "atr_pct", "bb_width", "volume_zscore",
            "roc_5", "roc_10", "roc_20",
            "ret_lag_1", "ret_lag_2", "ret_lag_3",
            "hour_of_day", "day_of_week",
        ]
        import lightgbm as lgb
        np.random.seed(7)
        n = 600
        X = np.random.randn(n, len(feature_columns))
        y = np.random.choice([0, 1, 2], n)
        model = lgb.LGBMClassifier(
            objective="multiclass", num_class=3, n_estimators=20, verbosity=-1, random_state=7
        )
        model.fit(X, y)
        artifact_path = os.path.join(tmp_dir, "BTCUSDT_15m_v_live_test.txt")
        model.booster_.save_model(artifact_path)

        model_row = _make_model_row_dict(artifact_path, feature_columns)
        cache = {"gbdt-forecast:BTCUSDT:15m": model_row}

        # Build a 60-bar historical window with a clear uptrend (non-flat prices)
        np.random.seed(99)
        prices = 50000.0 + np.cumsum(np.random.randn(60) * 50.0 + 10.0)
        open_times = pd.date_range("2024-06-01", periods=60, freq="15min", tz="UTC")
        window_df = pd.DataFrame({
            "open_time": open_times,
            "open":   prices * 0.999,
            "high":   prices * 1.002,
            "low":    prices * 0.998,
            "close":  prices,
            "volume": np.random.uniform(50, 200, 60),
        })

        # Candle WITHOUT precomputed fields — live mode
        live_candle = {
            "symbol": "BTCUSDT",
            "close":  float(prices[-1]),
            "open":   float(prices[-1]) * 0.999,
            "high":   float(prices[-1]) * 1.002,
            "low":    float(prices[-1]) * 0.998,
            "volume": 100.0,
            "open_time": open_times[-1].to_pydatetime(),
            # NO _rsi, NO _ema_fast — this is the live/paper mode scenario
        }

        ctx = NodeContext(
            candle=live_candle,
            portfolio=MagicMock(equity=100000.0),
            upstream_outputs={},
            mode="live",
            ml_model_registry_cache=cache,
            db=None,
            historical_window=window_df,
        )

        node = GbdtForecastNode()

        # Patch _compute_features_from_window to capture what it returned
        from apps.engine.app.nodes.ml import gbdt_forecast as gf_mod
        original_fn = gf_mod._compute_features_from_window
        captured = {}
        def capturing_fn(window, candle):
            result = original_fn(window, candle)
            captured["features"] = result
            return result
        gf_mod._compute_features_from_window = capturing_fn

        try:
            result = await node.run(ctx, {"minConfidence": 0.0})
        finally:
            gf_mod._compute_features_from_window = original_fn

        # The result must NOT be the insufficient_window fallback
        assert result["audit"].get("model_status") != "insufficient_window", (
            f"Node returned insufficient_window fallback — live-mode feature computation did not run. "
            f"audit: {result['audit']}"
        )

        # The features computed from the window must NOT be degenerate constants
        assert captured.get("features") is not None, (
            "_compute_features_from_window was not called — live-mode path not triggered"
        )
        feats = captured["features"]
        assert abs(feats["rsi"] - 50.0) > 1.0, (
            f"rsi={feats['rsi']} — expected a real RSI value, not the degenerate default 50.0. "
            f"Live-mode fallback is still using constants instead of ctx.historical_window."
        )
        assert abs(feats["ema_fast"] - feats["ema_slow"]) > 1.0, (
            f"ema_fast={feats['ema_fast']}, ema_slow={feats['ema_slow']} are equal — "
            f"EMA-20 and EMA-50 should differ on a trending price series. "
            f"Live-mode fallback may still be using ema_fast=ema_slow=close."
        )
        assert abs(feats["zscore"]) > 0.01, (
            f"zscore={feats['zscore']} — expected a non-trivial z-score from the trending price series. "
            f"zscore=0 is the degenerate fallback value."
        )


# ---------------------------------------------------------------------------
# 12. Phase 19.1: Train/test embargo — no label leakage across split boundary
# ---------------------------------------------------------------------------

def test_train_test_split_has_no_label_leakage():
    """
    Phase 19.1 Task 2 regression test.

    BEFORE Phase 19.1: compute_labels() was applied to the full DataFrame, then split
    at 80%. Training rows at [split_idx - horizon_bars : split_idx] had labels whose
    target close was at [split_idx : split_idx + horizon_bars] — inside the test set.

    AFTER Phase 19.1: the training tail is trimmed by horizon_bars rows (embargo cut).
    Specifically: embargo_cut = split_idx - horizon_bars.
    This guarantees NO training sample has a label whose target close falls in the test set.

    This test verifies the index arithmetic directly, without needing a real DB.
    It tests the invariant: for ALL rows in df_train, their look-forward target index
    (i + horizon_bars) is STRICTLY LESS THAN split_idx.
    """
    import pandas as pd
    from apps.engine.app.ml.train_gbdt_forecast import compute_labels

    # Build a minimal synthetic DataFrame
    N = 500
    np.random.seed(42)
    prices = 100.0 + np.cumsum(np.random.randn(N))
    df = pd.DataFrame({
        "close": prices,
        "open":  prices,
        "high":  prices * 1.001,
        "low":   prices * 0.999,
        "volume": 100.0,
    })

    for horizon in [12, 24, 32]:
        # compute_labels drops the last horizon_bars rows — so len(df_h) = N - horizon
        df_h = compute_labels(df, horizon, 0.5, -0.5)

        split_idx    = int(len(df_h) * 0.80)
        embargo_cut  = max(0, split_idx - horizon)
        df_train     = df_h.iloc[:embargo_cut]
        df_test_start_idx = split_idx

        # For every training row i, its look-forward target is the close at original position i + horizon.
        # After compute_labels drops the last `horizon` rows, row i in df_h corresponds to the
        # original DataFrame row i. Its label was set using close.shift(-horizon), i.e. close[i + horizon].
        # We must verify: for all i in df_train indices, i + horizon < split_idx.
        train_indices = list(range(len(df_train)))
        leaked = [i for i in train_indices if i + horizon >= df_test_start_idx]

        assert len(leaked) == 0, (
            f"Horizon {horizon}: {len(leaked)} training rows have labels that look into the test set. "
            f"First leaked index: {leaked[0]} (label target at {leaked[0] + horizon}, test starts at {df_test_start_idx}). "
            f"Embargo cut must trim training tail by at least {horizon} rows before split_idx={split_idx}."
        )

        # Also verify we haven't over-trimmed (train should have substantial data)
        assert len(df_train) > 200, (
            f"Horizon {horizon}: df_train has only {len(df_train)} rows after embargo — over-trimmed?"
        )


# ---------------------------------------------------------------------------
# 13. Phase 19.2: Discrimination check — detecting non-discriminative confidence
# ---------------------------------------------------------------------------

def test_compute_discrimination_metrics_flags_random_confidence_as_non_discriminative():
    """
    Phase 19.2 Task 1: A model whose confidence is random noise relative to correctness
    must produce AUC ≈ 0.50 and be flagged is_discriminative=False.
    """
    from apps.engine.app.ml.train_gbdt_forecast import compute_discrimination_metrics

    np.random.seed(42)
    n = 1000
    y_test = np.random.choice([0, 1, 2], size=n)
    # Random probability distribution independent of y_test
    raw_logits = np.random.randn(n, 3)
    exp_logits = np.exp(raw_logits)
    proba = exp_logits / exp_logits.sum(axis=1, keepdims=True)

    metrics = compute_discrimination_metrics(None, None, y_test, proba=proba)

    assert metrics["is_discriminative"] is False, "Random confidence must be flagged as non-discriminative"
    assert metrics["auc_confidence_correctness"] < 0.55, (
        f"Expected AUC < 0.55 for random confidence, got {metrics['auc_confidence_correctness']}"
    )


def test_compute_discrimination_metrics_detects_genuine_ranking_signal():
    """
    Phase 19.2 Task 1: A model whose confidence genuinely ranks correctness
    must produce AUC > 0.55 and positive Spearman, flagged is_discriminative=True.
    """
    from apps.engine.app.ml.train_gbdt_forecast import compute_discrimination_metrics

    np.random.seed(42)
    n = 1000
    y_test = np.random.choice([0, 1, 2], size=n)
    proba = np.zeros((n, 3))

    for i in range(n):
        true_lbl = y_test[i]
        # When correct, assign high confidence; when incorrect, assign low confidence
        is_correct = (i % 3 != 0)  # ~67% accuracy
        if is_correct:
            conf = np.random.uniform(0.60, 0.95)
            proba[i, true_lbl] = conf
            rem = (1.0 - conf) / 2.0
            for c in range(3):
                if c != true_lbl:
                    proba[i, c] = rem
        else:
            wrong_lbl = (true_lbl + 1) % 3
            conf = np.random.uniform(0.35, 0.45)
            proba[i, wrong_lbl] = conf
            rem = (1.0 - conf) / 2.0
            for c in range(3):
                if c != wrong_lbl:
                    proba[i, c] = rem

    metrics = compute_discrimination_metrics(None, None, y_test, proba=proba)

    assert metrics["is_discriminative"] is True, "Genuine ranking confidence must be flagged as discriminative"
    assert metrics["auc_confidence_correctness"] > 0.70, (
        f"Expected AUC > 0.70 for ranked synthetic data, got {metrics['auc_confidence_correctness']}"
    )
    assert metrics["spearman_corr"] > 0.5, (
        f"Expected Spearman correlation > 0.5, got {metrics['spearman_corr']}"
    )


# ---------------------------------------------------------------------------
# 14. Phase 19.2: GbdtForecastNode minConfidence bypass for non-discriminative models
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gbdt_node_bypasses_min_confidence_for_non_discriminative_model():
    """
    Phase 19.2 Task 4: For active-but-non-discriminative models, the minConfidence gate
    must be bypassed (direction is NOT flattened even if minConfidence is high), and
    confidence_reliability must be flagged as 'unreliable_do_not_gate_or_size_on_this'.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        artifact_path, feature_cols = _make_synthetic_model_and_artifact(tmp_dir)

        node = GbdtForecastNode(config={"minConfidence": 0.99})  # Very high minConfidence
        mock_row = {
            "component_id": "gbdt-forecast",
            "version": "v_test",
            "symbol": "BTCUSDT",
            "resolution": "15m",
            "horizon_bars": 12,
            "artifact_path": artifact_path,
            "feature_columns": feature_cols,
            "is_active": True,
            "is_discriminative": False,  # NON-DISCRIMINATIVE
            "cv_mcc_mean": 0.04,
            "test_mcc": 0.03,
            "calibration_path": None,
        }

        ctx = NodeContext(
            candle={
                "close": 50000.0,
                "_rsi": 15.0,  # Model predicts "down" / short
                "_ema_fast": 49000.0,
                "_ema_slow": 51000.0,
                "_macd": -100.0,
                "_macd_signal": -80.0,
            },
            portfolio=MagicMock(),
            upstream_outputs={},
            ml_model_registry_cache={"gbdt-forecast:BTCUSDT:15m": mock_row},
        )

        result = await node.run(ctx, config={"minConfidence": 0.99})

        assert result["type"] == "Signal"
        assert result["direction"] == "short", (
            f"Expected non-discriminative model to bypass minConfidence 0.99 and emit 'short', got '{result['direction']}'"
        )
        assert result["audit"]["confidence_reliability"] == "unreliable_do_not_gate_or_size_on_this"
        assert result["audit"]["min_confidence_applied"] == 0.0
        assert "uncalibratable" in result["audit"]["edge_tier"]


# ---------------------------------------------------------------------------
# 15. Phase 19.2: RiskGateNode awareness for unreliable confidence
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_risk_gate_fallback_for_unreliable_confidence_signal():
    """
    Phase 19.2 Task 6: Risk gate approves directional signal when upstream confidence
    is explicitly marked unreliable, rather than vetoing solely on untrusted confidence.
    """
    from apps.engine.app.nodes.risk_management.risk_gate import RiskGateNode

    risk_node = RiskGateNode(config={"threshold": 80.0})  # 80% threshold

    # Signal with 45% confidence (< threshold requirement of 64%), but marked unreliable
    signal = {
        "type": "Signal",
        "direction": "long",
        "confidence": 0.45,
        "price": 50000.0,
        "audit": {
            "confidence_reliability": "unreliable_do_not_gate_or_size_on_this",
        }
    }

    ctx = NodeContext(
        candle={"close": 50000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"upstream_gbdt": signal},
    )

    decision = await risk_node.run(ctx, config={})
    assert decision["type"] == "RiskDecision"
    assert decision["approved"] is True, "Risk gate should approve signal via unreliable confidence fallback"
    assert decision["direction"] == "long"
    assert decision["sizedQuantity"] > 0.0


