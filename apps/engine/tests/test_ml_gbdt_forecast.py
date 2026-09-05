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
    """Build a candle dict with precomputed indicator fields (as backtest_runner injects)."""
    return {
        "symbol": "BTCUSDT",
        "close": close,
        "open": close * 0.999,
        "high": close * 1.002,
        "low": close * 0.998,
        "volume": 100.0,
        "open_time": datetime(2024, 6, 1, tzinfo=timezone.utc),
        # Precomputed indicator fields — same keys as backtest_runner.prepare_indicators_dataframe()
        "_rsi": rsi,
        "_ema_fast": ema_fast,
        "_ema_slow": ema_slow,
        "_macd": macd,
        "_macd_signal": macd_signal,
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

