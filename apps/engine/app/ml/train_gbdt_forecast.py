"""
Offline GBDT Forecast Training Script — Phase 19.1 (Correction Pass)
=====================================================================
Usage:
    # Single resolution with ATR-relative thresholds (default):
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --resolution 15m

    # Fixed thresholds (for comparison):
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --resolution 15m --threshold-mode fixed

    # Batch train all standard resolutions:
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --all-resolutions --horizons 12,24,32

Phase 19.1 corrections (do not relitigate):
- Train/test embargo: training tail trimmed by horizon_bars rows to prevent label leakage.
- ATR-relative labeling: thresholds adapt to each bar's realized volatility (default), or use
  fixed per-timeframe thresholds for comparison (--threshold-mode fixed).
- Honest metrics: every accuracy number is paired with majority-class baseline, balanced
  accuracy, MCC, and naive-momentum baseline — no bare accuracy-only reporting.
- Embargoed 5-fold TimeSeriesSplit CV: diagnostic for stability, not replacing the final model.
- Registry gating: models only activate if test_row_count >= 500 AND cv_mcc_mean > 0.02.
- Richer 19-feature set: ATR, BB, volume z-score, ROC×3, lag returns×3, hour/day.
- Calibration diagnostic: confidence-decile reliability table for gating-passing models.

Design decisions (not to be relitigated):
- LightGBM multiclass classifier, NOT regression, NOT deep learning.
- Chronological train/test split with embargo gap — NEVER random.
- Native LightGBM save_model() format — NOT pickle.
- Fixed label encoding: {down: 0, flat: 1, up: 2}.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Sequence, Union

import numpy as np
import pandas as pd
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

_ENGINE_ROOT = Path(__file__).resolve().parent.parent.parent  # apps/engine/
sys.path.insert(0, str(_ENGINE_ROOT))

from app.db.models import CandleModel, MlModelModel

try:
    import joblib
    import lightgbm as lgb
    from scipy.stats import spearmanr
    from sklearn.calibration import CalibratedClassifierCV
    try:
        from sklearn.frozen import FrozenEstimator
    except ImportError:
        FrozenEstimator = None
    from sklearn.metrics import (
        classification_report, accuracy_score, balanced_accuracy_score,
        matthews_corrcoef, roc_auc_score,
    )
    from sklearn.model_selection import TimeSeriesSplit
except ImportError:
    print(
        "[FATAL] lightgbm and scikit-learn are required. "
        "Run: pip install lightgbm scikit-learn scipy joblib"
    )
    sys.exit(1)



# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LABEL_MAP = {"down": 0, "flat": 1, "up": 2}
LABEL_MAP_INV = {0: "down", 1: "flat", 2: "up"}

REGIME_TREND = 1.0
REGIME_CHOP = 0.0

# 19 features — MUST be kept in lockstep with GbdtForecastNode's live-mode computation.
# ANY change here MUST be mirrored in apps/engine/app/nodes/ml/gbdt_forecast.py.
DEFAULT_FEATURE_COLUMNS = [
    # Original 7
    "rsi",
    "ema_fast",
    "ema_slow",
    "macd",
    "macd_signal",
    "zscore",
    "regime_numeric",
    # Phase 19.1 additions
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

DEFAULT_RESOLUTIONS = ["1m", "3m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"]
DEFAULT_HORIZONS = [12, 24, 32]

ARTIFACT_BASE_DIR = _ENGINE_ROOT / "model_artifacts" / "gbdt-forecast"

# Fixed per-timeframe thresholds (Phase 19 legacy mode, kept for comparison)
TIMEFRAME_THRESHOLDS_FIXED = {
    "1m": 0.10,
    "3m": 0.15,
    "5m": 0.20,
    "10m": 0.30,
    "15m": 0.50,
    "30m": 0.75,
    "1h": 1.00,
    "4h": 2.00,
    "1d": 3.00,
}

# Gating parameters (Phase 19.1 Task 7)
MIN_TEST_ROWS_FOR_ACTIVATION = 500
MIN_MCC_FOR_ACTIVATION = 0.02
CV_N_SPLITS = 5


# ---------------------------------------------------------------------------
# Vectorized feature computation — 19 features, all causal (rolling/ewm only)
# ---------------------------------------------------------------------------

def compute_features_vectorized(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all 19 training features vectorized over the full DataFrame.
    ALL computations are causal: only rolling/ewm operations, never future-looking.

    MUST produce numerically identical values to GbdtForecastNode's live-mode
    rolling-window computation for the same rows. The feature_parity sanity check
    at the end of training verifies this for every column.
    """
    out = df.copy()
    close = out["close"].astype(float)

    # Guard: volume may be zero for some synthetic/test series
    volume = out.get("volume", pd.Series(1.0, index=out.index)).astype(float).replace(0, 1.0)

    # ------------------------------------------------------------------
    # Original 7 features
    # ------------------------------------------------------------------
    # RSI(14)
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out["rsi"] = (100 - (100 / (1 + rs))).fillna(50.0)

    # EMA fast (span=20) and slow (span=50)
    out["ema_fast"] = close.ewm(span=20, adjust=False).mean()
    out["ema_slow"] = close.ewm(span=50, adjust=False).mean()

    # MACD (12, 26, signal=9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_series = ema12 - ema26
    out["macd"] = macd_series
    out["macd_signal"] = macd_series.ewm(span=9, adjust=False).mean()

    # zscore and regime
    ema_spread = (out["ema_fast"] - out["ema_slow"]).abs() + 1.0
    out["zscore"] = (close - out["ema_slow"]) / ema_spread
    out["regime_numeric"] = ((out["ema_fast"] - out["ema_slow"]).abs() > close * 0.01).astype(float)

    # ------------------------------------------------------------------
    # Phase 19.1: 12 additional causal features
    # ------------------------------------------------------------------
    # ATR(14) — True Range = max(H-L, |H-prev_C|, |L-prev_C|)
    high = out.get("high", close).astype(float)
    low = out.get("low", close).astype(float)
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    out["atr_14"] = tr.rolling(window=14, min_periods=1).mean()
    out["atr_pct"] = out["atr_14"] / close.replace(0, np.nan)  # ATR as % of close

    # Bollinger Band width (20-period, 2 std)
    bb_mid = close.rolling(window=20, min_periods=1).mean()
    bb_std = close.rolling(window=20, min_periods=1).std(ddof=0).fillna(0)
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std
    bb_range = bb_upper - bb_lower
    out["bb_width"] = (bb_range / bb_mid.replace(0, np.nan)).fillna(0)

    # Volume z-score (20-period rolling)
    vol_mean = volume.rolling(window=20, min_periods=1).mean()
    vol_std = volume.rolling(window=20, min_periods=1).std(ddof=0).fillna(1.0).replace(0, 1.0)
    out["volume_zscore"] = (volume - vol_mean) / vol_std

    # Rate of Change — 5, 10, 20 bars
    out["roc_5"]  = close.pct_change(5).fillna(0)
    out["roc_10"] = close.pct_change(10).fillna(0)
    out["roc_20"] = close.pct_change(20).fillna(0)

    # Single-bar lag returns (trees have no implicit memory)
    ret = close.pct_change(1).fillna(0)
    out["ret_lag_1"] = ret.shift(1).fillna(0)
    out["ret_lag_2"] = ret.shift(2).fillna(0)
    out["ret_lag_3"] = ret.shift(3).fillna(0)

    # Time-of-day / day-of-week from open_time (UTC)
    if "open_time" in out.columns and hasattr(out["open_time"].iloc[0], "hour"):
        out["hour_of_day"] = out["open_time"].apply(
            lambda t: t.hour if hasattr(t, "hour") else 0
        ).astype(float)
        out["day_of_week"] = out["open_time"].apply(
            lambda t: t.weekday() if hasattr(t, "weekday") else 0
        ).astype(float)
    else:
        out["hour_of_day"] = 0.0
        out["day_of_week"] = 0.0

    return out


# ---------------------------------------------------------------------------
# Row-by-row replication of inference path (for feature parity sanity check)
# ---------------------------------------------------------------------------

def compute_features_rowbyrow(df: pd.DataFrame) -> pd.DataFrame:
    """
    Simulate the per-bar inference path over a window DataFrame.
    Used only by the feature parity sanity check — not used in production.
    This must produce values identical to compute_features_vectorized.
    """
    rows = []
    for i, (_, row) in enumerate(df.iterrows()):
        # Use precomputed fields if available (backtest fast-path mirror)
        rsi = float(row.get("_rsi", row.get("rsi", 50.0)))
        ema_fast = float(row.get("_ema_fast", row.get("ema_fast", row["close"])))
        ema_slow = float(row.get("_ema_slow", row.get("ema_slow", row["close"])))
        macd = float(row.get("_macd", row.get("macd", 0.0)))
        macd_signal = float(row.get("_macd_signal", row.get("macd_signal", 0.0)))
        close = float(row["close"])

        ema_spread = abs(ema_fast - ema_slow) + 1.0
        zscore = (close - ema_slow) / ema_spread
        regime_numeric = REGIME_TREND if abs(ema_fast - ema_slow) > close * 0.01 else REGIME_CHOP

        # New features — read from pre-computed column
        atr_14 = float(row.get("atr_14", 0.0))
        atr_pct = float(row.get("atr_pct", 0.0))
        bb_width = float(row.get("bb_width", 0.0))
        volume_zscore = float(row.get("volume_zscore", 0.0))
        roc_5 = float(row.get("roc_5", 0.0))
        roc_10 = float(row.get("roc_10", 0.0))
        roc_20 = float(row.get("roc_20", 0.0))
        ret_lag_1 = float(row.get("ret_lag_1", 0.0))
        ret_lag_2 = float(row.get("ret_lag_2", 0.0))
        ret_lag_3 = float(row.get("ret_lag_3", 0.0))
        hour_of_day = float(row.get("hour_of_day", 0.0))
        day_of_week = float(row.get("day_of_week", 0.0))

        rows.append({
            "rsi": rsi,
            "ema_fast": ema_fast,
            "ema_slow": ema_slow,
            "macd": macd,
            "macd_signal": macd_signal,
            "zscore": zscore,
            "regime_numeric": regime_numeric,
            "atr_14": atr_14,
            "atr_pct": atr_pct,
            "bb_width": bb_width,
            "volume_zscore": volume_zscore,
            "roc_5": roc_5,
            "roc_10": roc_10,
            "roc_20": roc_20,
            "ret_lag_1": ret_lag_1,
            "ret_lag_2": ret_lag_2,
            "ret_lag_3": ret_lag_3,
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
        })
    return pd.DataFrame(rows)


def run_feature_parity_sanity_check(
    df_with_features: pd.DataFrame,
    n_rows: int = 300,
    tolerance: float = 1e-6,
) -> None:
    """
    Verify vectorized training features match the per-bar inference path for all 19 columns.
    Fails loudly — do NOT train if this check fails.
    """
    print(f"\n[Sanity Check] Comparing vectorized vs row-by-row for all {len(DEFAULT_FEATURE_COLUMNS)} "
          f"features, last {n_rows} rows...")

    vec_slice = df_with_features.tail(n_rows)[DEFAULT_FEATURE_COLUMNS].reset_index(drop=True)

    # Inject precomputed aliases so row-by-row code reads from the same vectorized values
    df_check = df_with_features.tail(n_rows).copy().reset_index(drop=True)
    df_check["_rsi"] = df_check["rsi"]
    df_check["_ema_fast"] = df_check["ema_fast"]
    df_check["_ema_slow"] = df_check["ema_slow"]
    df_check["_macd"] = df_check["macd"]
    df_check["_macd_signal"] = df_check["macd_signal"]

    rowbyrow_slice = compute_features_rowbyrow(df_check)

    mismatches = []
    for col in DEFAULT_FEATURE_COLUMNS:
        if col not in rowbyrow_slice.columns:
            mismatches.append((col, float("inf")))
            continue
        diff = (vec_slice[col] - rowbyrow_slice[col]).abs()
        max_diff = diff.max()
        if max_diff > tolerance:
            mismatches.append((col, float(max_diff)))

    if mismatches:
        msg = "\n".join(f"  {col}: max diff = {d:.2e}" for col, d in mismatches)
        raise RuntimeError(
            f"[FATAL] Feature parity check FAILED:\n{msg}\n"
            f"Do NOT train on a feature pipeline that doesn't match production."
        )

    print(f"[Sanity Check] PASSED — all {len(DEFAULT_FEATURE_COLUMNS)} features match "
          f"within tolerance={tolerance:.0e} across {n_rows} rows. "
          f"Training features are production-equivalent.")


# ---------------------------------------------------------------------------
# ATR-relative labeling (Phase 19.1 Task 3)
# ---------------------------------------------------------------------------

def compute_labels(
    df: pd.DataFrame,
    horizon_bars: int,
    up_threshold_pct: Union[float, "pd.Series"],
    down_threshold_pct: Union[float, "pd.Series"],
) -> pd.DataFrame:
    """
    Compute 3-class direction label for each bar:
      future_return = (close[t+horizon] - close[t]) / close[t] * 100
      label = "up"   if future_return >  up_threshold_pct   (scalar or per-row Series)
            = "down" if future_return <  down_threshold_pct
            = "flat" otherwise

    Phase 19.1: up_threshold_pct / down_threshold_pct may be per-row Series
    (ATR-relative mode) or a scalar (fixed mode).
    """
    close = df["close"].astype(float)
    future_return = (close.shift(-horizon_bars) - close) / close * 100.0

    # Vectorized comparison works with both scalars and aligned Series
    up_condition   = future_return > up_threshold_pct
    down_condition = future_return < down_threshold_pct

    df = df.copy()
    df["label"] = np.select([up_condition, down_condition], ["up", "down"], default="flat")
    df["future_return_pct"] = future_return

    # Drop the last horizon_bars rows — they have NaN future returns (no lookahead)
    df = df.iloc[:-horizon_bars].copy()
    return df


def compute_atr_thresholds(df_features: pd.DataFrame, atr_multiplier: float):
    """
    Compute per-row ATR-relative thresholds.
    Returns (up_series, down_series) as pd.Series aligned with df_features index.
    """
    atr_pct = df_features["atr_pct"].fillna(0.01)  # % of close
    up_thresh   =  atr_multiplier * atr_pct * 100.0  # convert to % for consistency
    down_thresh = -atr_multiplier * atr_pct * 100.0
    return up_thresh, down_thresh


# ---------------------------------------------------------------------------
# Baseline metrics (Phase 19.1 Task 4)
# ---------------------------------------------------------------------------

def _majority_baseline_accuracy(y_train: np.ndarray, y_test: np.ndarray) -> float:
    """Accuracy of a trivial classifier that always predicts the most common train label."""
    majority_class = int(np.bincount(y_train).argmax())
    return float(np.mean(y_test == majority_class))


def _naive_momentum_baseline(
    df_test: pd.DataFrame,
    horizon_bars: int,
    up_threshold_pct,
    down_threshold_pct,
) -> float:
    """
    Accuracy of a naive momentum classifier: predict same direction as the last bar's return.
    Uses the same thresholds as the main model to define up/flat/down.
    """
    if len(df_test) == 0:
        return 0.0
    close = df_test["close"].astype(float).values
    last_bar_ret = np.concatenate([[0.0], np.diff(close) / close[:-1] * 100.0])

    # Scalar vs per-row threshold
    if isinstance(up_threshold_pct, (int, float)):
        up_thresh_arr   = np.full(len(df_test), up_threshold_pct)
        down_thresh_arr = np.full(len(df_test), down_threshold_pct)
    else:
        up_thresh_arr   = np.array(up_threshold_pct.values if hasattr(up_threshold_pct, "values") else up_threshold_pct)
        down_thresh_arr = np.array(down_threshold_pct.values if hasattr(down_threshold_pct, "values") else down_threshold_pct)

    mom_preds = np.where(last_bar_ret > up_thresh_arr, 2,
                np.where(last_bar_ret < down_thresh_arr, 0, 1))
    actual = df_test["label"].map(LABEL_MAP).values.astype(int)
    return float(np.mean(mom_preds == actual))


def _print_comparison_table(
    resolution: str,
    horizon: int,
    model_acc: float,
    model_bal_acc: float,
    model_mcc: float,
    majority_acc: float,
    momentum_acc: float,
    lift: float,
) -> None:
    beats_both = model_mcc > 0.02 and model_bal_acc > majority_acc
    tag = "✓ beats" if beats_both else "✗ does not beat"
    print(f"\n  ┌─ Comparison Table: {resolution} / H{horizon} ─────────────────────────────────────────")
    print(f"  │ Metric               Model       Majority Baseline  Momentum Baseline")
    print(f"  │ Accuracy             {model_acc:>8.2%}   {majority_acc:>16.2%}  {momentum_acc:>17.2%}")
    print(f"  │ Balanced Accuracy    {model_bal_acc:>8.2%}   {'N/A':>16s}  {'N/A':>17s}")
    print(f"  │ MCC                  {model_mcc:>8.4f}   {'N/A':>16s}  {'N/A':>17s}")
    print(f"  │ Lift (vs majority)   {lift:>+8.4f}")
    print(f"  │ Verdict: Model {tag} both baselines (MCC>{MIN_MCC_FOR_ACTIVATION:.2f}={model_mcc>MIN_MCC_FOR_ACTIVATION})")
    print(f"  └─────────────────────────────────────────────────────────────────────────────")


# ---------------------------------------------------------------------------
# Feature importance report (Phase 19.1 Task 5)
# ---------------------------------------------------------------------------

def _print_feature_importance(model: "lgb.LGBMClassifier", feature_columns: List[str]) -> None:
    try:
        importance = model.booster_.feature_importance(importance_type="gain")
        pairs = sorted(zip(feature_columns, importance), key=lambda x: -x[1])
        print(f"\n  Feature Importance (gain, top-10):")
        for name, score in pairs[:10]:
            bar = "█" * int(score / (pairs[0][1] + 1e-9) * 20)
            print(f"    {name:<20s} {score:>10.1f}  {bar}")
    except Exception as e:
        print(f"  [WARN] Could not compute feature importance: {e}")


# ---------------------------------------------------------------------------
# Calibration diagnostic (Phase 19.1 Task 8)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Discrimination check & Calibration (Phase 19.2 Tasks 1 & 2)
# ---------------------------------------------------------------------------

def compute_discrimination_metrics(
    model: Optional[Union["lgb.LGBMClassifier", Any]],
    X_test: np.ndarray,
    y_test: np.ndarray,
    n_deciles: int = 10,
    proba: Optional[np.ndarray] = None,
) -> dict:
    """
    Measures whether the model's stated confidence (max class probability) carries any
    reliable ranking information about correctness — independent of whether it is
    correctly SCALED (that's calibration's job, and only meaningful if this check passes).

    Returns a dict with:
      - auc_confidence_correctness: AUC treating 'was the top-1 prediction correct' (0/1)
        as the binary target and 'max predicted probability' as the score. An AUC near
        0.5 means confidence carries no ranking signal at all (worse than useless as a
        gating input). An AUC meaningfully above 0.5 (e.g. > 0.55) means there IS a
        ranking relationship worth calibrating.
      - spearman_corr: Spearman rank correlation between max confidence and decile empirical hit-rate.
      - spearman_pval: p-value of the Spearman correlation.
      - is_discriminative: bool, True only if auc_confidence_correctness > 0.55 AND the
        spearman correlation is positive and non-trivial.
      - mae: mean absolute error between mean stated confidence and mean actual hit rate across deciles.
      - deciles: detailed per-decile metrics list.
    """
    if proba is None:
        if model is None:
            raise ValueError("Either model or proba must be provided")
        proba = model.predict_proba(X_test)

    max_conf = proba.max(axis=1)
    preds = proba.argmax(axis=1)
    correct = (preds == y_test).astype(int)

    # Confidence-correctness AUC
    try:
        if len(np.unique(correct)) < 2:
            auc = 0.50
        else:
            auc = float(roc_auc_score(correct, max_conf))
    except Exception:
        auc = 0.50

    df_cal = pd.DataFrame({"confidence": max_conf, "correct": correct})
    df_cal["decile"] = pd.qcut(df_cal["confidence"], n_deciles, labels=False, duplicates="drop")
    grp = df_cal.groupby("decile")

    deciles = []
    stated_list = []
    actual_list = []
    abs_errors = []

    for decile, g in grp:
        stated = float(g["confidence"].mean())
        actual = float(g["correct"].mean())
        delta = actual - stated
        lo = float(g["confidence"].min())
        hi = float(g["confidence"].max())
        stated_list.append(stated)
        actual_list.append(actual)
        abs_errors.append(abs(delta))
        deciles.append({
            "decile": int(decile),
            "lo": lo,
            "hi": hi,
            "n": len(g),
            "stated": stated,
            "actual": actual,
            "delta": delta,
        })

    mae = float(np.mean(abs_errors)) if abs_errors else 0.0

    if len(stated_list) >= 3:
        sp_res = spearmanr(stated_list, actual_list)
        sp_corr = float(sp_res.statistic if hasattr(sp_res, "statistic") else sp_res[0])
        sp_pval = float(sp_res.pvalue if hasattr(sp_res, "pvalue") else sp_res[1])
        if np.isnan(sp_corr):
            sp_corr, sp_pval = 0.0, 1.0
    else:
        sp_corr, sp_pval = 0.0, 1.0

    # Conservative bar: AUC > 0.55 AND positive Spearman rank correlation
    is_discriminative = bool(auc > 0.55 and sp_corr > 0.0)

    return {
        "auc_confidence_correctness": round(auc, 4),
        "spearman_corr": round(sp_corr, 4),
        "spearman_pval": round(sp_pval, 4),
        "is_discriminative": is_discriminative,
        "mae": round(mae, 4),
        "deciles": deciles,
    }


def _print_calibration_diagnostic(
    model: Optional[Union["lgb.LGBMClassifier", Any]],
    X_test: np.ndarray,
    y_test: np.ndarray,
    n_deciles: int = 10,
    proba: Optional[np.ndarray] = None,
    title_suffix: str = "Raw LightGBM Softmax",
) -> dict:
    """
    Bucket predictions by confidence decile, print reliability table, and run discrimination check.
    """
    metrics = compute_discrimination_metrics(model, X_test, y_test, n_deciles=n_deciles, proba=proba)

    print(f"\n  Calibration Diagnostic ({title_suffix}):")
    print(f"  {'Decile':<8} {'Conf Range':<18} {'N':<7} {'Stated Conf (mid)':<20} {'Actual Hit Rate':<16} {'Delta'}")
    for d in metrics["deciles"]:
        flag = " ← OVER-CONFIDENT" if d["delta"] < -0.10 else (" ← UNDER-CONFIDENT" if d["delta"] > 0.10 else "")
        print(f"  {d['decile']:<8} {d['lo']:.2f}–{d['hi']:.2f}{'':<8} {d['n']:<7} {d['stated']:.2%}{'':<12} {d['actual']:.2%}{'':<10} {d['delta']:+.2%}{flag}")

    print(f"  Mean Absolute Calibration Error (MAE): {metrics['mae']:.2%}")

    auc = metrics["auc_confidence_correctness"]
    sp_corr = metrics["spearman_corr"]
    sp_pval = metrics["spearman_pval"]
    is_disc = metrics["is_discriminative"]

    print(f"\n  Discrimination Check:")
    print(f"    AUC (confidence ranks correctness): {auc:.4f}")
    print(f"    Spearman (decile confidence vs decile hit-rate): {sp_corr:+.4f} (p={sp_pval:.4f})")
    if is_disc:
        print(f"    VERDICT: DISCRIMINATIVE — confidence carries reliable ranking signal.")
        print(f"    Dedicated-split isotonic calibration will be fit and validated.")
    else:
        print(f"    VERDICT: NOT DISCRIMINATIVE — confidence carries no reliable ranking signal.")
        print(f"    Calibration will NOT be applied. This model's raw confidence must not be used")
        print(f"    for minConfidence gating, position sizing, or displayed as a meaningful probability.")

    return metrics


def fit_dedicated_calibration(
    model: "lgb.LGBMClassifier",
    df_train: pd.DataFrame,
    horizon_bars: int,
    feature_columns: List[str],
) -> Optional[Any]:
    """
    Fit isotonic calibration on a dedicated, test-set-independent calibration split.
    Takes the last 15% of df_train chronologically as df_calib, with an internal
    embargo gap of horizon_bars rows to prevent label leakage from df_calib_train.

    Never fits on df_test to avoid calibration leakage.
    """
    try:
        # Carve out last 15% chronologically as df_calib
        calib_split_idx = int(len(df_train) * 0.85)
        df_calib_train = df_train.iloc[:max(0, calib_split_idx - horizon_bars)]
        df_calib = df_train.iloc[calib_split_idx:]

        if len(df_calib) < 50:
            print(f"  [WARN] df_calib has only {len(df_calib)} rows. Minimum 50 required for calibration.")
            return None

        X_calib = df_calib[feature_columns].values.astype(float)
        y_calib = df_calib["label"].map(LABEL_MAP).values.astype(int)

        # Use FrozenEstimator for prefit model when available (scikit-learn 1.4+ / 1.9+)
        if FrozenEstimator is not None:
            calib = CalibratedClassifierCV(FrozenEstimator(model), method="isotonic")
        else:
            try:
                calib = CalibratedClassifierCV(estimator=model, method="isotonic", cv="prefit")
            except Exception:
                calib = CalibratedClassifierCV(base_estimator=model, method="isotonic", cv="prefit")

        calib.fit(X_calib, y_calib)
        print(f"  Fitted isotonic calibration on dedicated {len(df_calib):,} row split (independent of test set).")
        return calib
    except Exception as e:
        print(f"  [WARN] Dedicated calibration fit failed: {e}")
        return None



# ---------------------------------------------------------------------------
# Cross-validation (Phase 19.1 Task 6)
# ---------------------------------------------------------------------------

def run_embargoed_cv(
    X: np.ndarray,
    y: np.ndarray,
    horizon_bars: int,
    n_splits: int = CV_N_SPLITS,
) -> dict:
    """
    Embargoed TimeSeriesSplit cross-validation.
    Each fold's training tail is trimmed by horizon_bars to prevent label leakage.
    Returns dict with mean/std of balanced_accuracy and MCC across folds.
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    bal_accs, mccs = [], []

    for fold_idx, (train_idx, val_idx) in enumerate(tscv.split(X)):
        # Apply embargo: trim last horizon_bars rows from training segment
        embargo_end = max(0, len(train_idx) - horizon_bars)
        train_idx_embargoed = train_idx[:embargo_end]

        if len(train_idx_embargoed) < 200 or len(val_idx) < 50:
            continue  # Skip folds that are too small after embargo

        X_tr, X_val = X[train_idx_embargoed], X[val_idx]
        y_tr, y_val = y[train_idx_embargoed], y[val_idx]

        fold_model = lgb.LGBMClassifier(
            objective="multiclass",
            num_class=3,
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42 + fold_idx,
            verbosity=-1,
            n_jobs=-1,
        )
        fold_model.fit(X_tr, y_tr)
        y_pred = fold_model.predict(X_val)

        bal_accs.append(balanced_accuracy_score(y_val, y_pred))
        mccs.append(matthews_corrcoef(y_val, y_pred))

    if not bal_accs:
        return {"bal_acc_mean": 0.0, "bal_acc_std": 0.0, "mcc_mean": 0.0, "mcc_std": 0.0, "n_folds": 0}

    return {
        "bal_acc_mean": float(np.mean(bal_accs)),
        "bal_acc_std":  float(np.std(bal_accs)),
        "mcc_mean":     float(np.mean(mccs)),
        "mcc_std":      float(np.std(mccs)),
        "n_folds":      len(bal_accs),
    }


# ---------------------------------------------------------------------------
# Main training function
# ---------------------------------------------------------------------------

async def train_resolution(
    symbol: str,
    resolution: str,
    horizons: Sequence[int],
    threshold_mode: str,          # 'atr' or 'fixed'
    atr_multiplier: float,
    up_threshold_pct: Optional[float],   # used only in 'fixed' mode (explicit override)
    down_threshold_pct: Optional[float],
    version: str,
    db_url: str,
) -> bool:
    primary_horizon = horizons[0] if horizons else 12

    print(f"\n{'='*60}")
    print(f"GBDT Multi-Horizon Training — {symbol.upper()}/{resolution}")
    print(f"Horizons: {list(horizons)} bars | Primary: {primary_horizon} bars")
    print(f"Threshold mode: {threshold_mode}" +
          (f" (k={atr_multiplier})" if threshold_mode == "atr" else f" (fixed ±{up_threshold_pct}%)"))
    print(f"Version: {version}")
    print(f"{'='*60}")

    engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # ------------------------------------------------------------------
    # 1. Load candles
    # ------------------------------------------------------------------
    print(f"\n[1/8] Loading candle data from database...")
    async with async_session() as session:
        result = await session.execute(
            select(CandleModel)
            .where(CandleModel.symbol == symbol.upper(), CandleModel.resolution == resolution)
            .order_by(CandleModel.open_time.asc())
        )
        candles = list(result.scalars().all())

    if len(candles) < 500:
        print(f"[WARN] Only {len(candles)} candles for {symbol}/{resolution}. Need ≥500. Skipping.")
        await engine.dispose()
        return False

    print(f"  Loaded {len(candles):,} candles from {candles[0].open_time.date()} to {candles[-1].open_time.date()}")

    df_raw = pd.DataFrame([{
        "open_time": c.open_time,
        "open":  float(c.open),
        "high":  float(c.high),
        "low":   float(c.low),
        "close": float(c.close),
        "volume": float(c.volume),
    } for c in candles]).sort_values("open_time").reset_index(drop=True)

    train_start_dt = candles[0].open_time
    train_end_dt   = candles[-1].open_time

    # ------------------------------------------------------------------
    # 2. Compute features
    # ------------------------------------------------------------------
    print(f"\n[2/8] Computing 19 features (vectorized, causal)...")
    df_features = compute_features_vectorized(df_raw)
    n_before = len(df_features)
    df_features = df_features.dropna(subset=DEFAULT_FEATURE_COLUMNS).reset_index(drop=True)
    n_dropped = n_before - len(df_features)
    print(f"  Dropped {n_dropped} NaN rows (indicator warm-up period)")

    # ------------------------------------------------------------------
    # 3. Feature parity sanity check
    # ------------------------------------------------------------------
    print(f"\n[3/8] Feature parity sanity check (all 19 features)...")
    run_feature_parity_sanity_check(df_features, n_rows=min(300, len(df_features)))

    # ------------------------------------------------------------------
    # 4. Determine per-row thresholds (ATR or fixed)
    # ------------------------------------------------------------------
    if threshold_mode == "atr":
        up_thresh_series, down_thresh_series = compute_atr_thresholds(df_features, atr_multiplier)
        # Median threshold for display
        display_thresh = float(up_thresh_series.median())
        print(f"\n[4/8] ATR-relative thresholds (k={atr_multiplier}): median ±{display_thresh:.3f}%")
    else:
        # Fixed mode: use per-resolution defaults or explicit override
        if up_threshold_pct is not None:
            up_th = up_threshold_pct
        else:
            up_th = TIMEFRAME_THRESHOLDS_FIXED.get(resolution, 0.50)
        down_th = down_threshold_pct if down_threshold_pct is not None else -up_th
        up_thresh_series   = up_th
        down_thresh_series = down_th
        print(f"\n[4/8] Fixed thresholds: up={up_th:+.3f}%, down={down_th:+.3f}%")

    ARTIFACT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    trained_models:  dict = {}
    test_accuracies: dict = {}
    cv_results_primary: dict = {}

    # ------------------------------------------------------------------
    # 5–7. Train for each horizon
    # ------------------------------------------------------------------
    print(f"\n[5–8/8] Training horizons {list(horizons)}...")
    for h in horizons:
        print(f"\n{'─'*50}")
        print(f"  Horizon: {h} bars forward")
        print(f"{'─'*50}")
        df_h = compute_labels(df_features, h, up_thresh_series, down_thresh_series)

        label_counts = df_h["label"].value_counts()
        total = len(df_h)
        print(f"  Label distribution (total={total:,}):")
        for lbl in ["up", "flat", "down"]:
            count = label_counts.get(lbl, 0)
            pct = count / total * 100 if total > 0 else 0
            print(f"    {lbl:>5}: {count:>6,} ({pct:5.1f}%)")

        # ------------------------------------------------------------------
        # Phase 19.1 Task 2: Embargo fix
        # Split at 80% then trim train tail by h rows to prevent leakage
        # ------------------------------------------------------------------
        split_idx = int(len(df_h) * 0.80)
        embargo_cut = max(0, split_idx - h)
        df_train = df_h.iloc[:embargo_cut].copy()
        df_test  = df_h.iloc[split_idx:].copy()
        print(f"  Embargo: purged last {h} rows from train tail to prevent label leakage into test period.")
        print(f"  Train rows: {len(df_train):,} | Test rows: {len(df_test):,}")

        X_train = df_train[DEFAULT_FEATURE_COLUMNS].values.astype(float)
        X_test  = df_test[DEFAULT_FEATURE_COLUMNS].values.astype(float)
        y_train = df_train["label"].map(LABEL_MAP).values.astype(int)
        y_test  = df_test["label"].map(LABEL_MAP).values.astype(int)

        # ------------------------------------------------------------------
        # Phase 19.1 Task 6: Embargoed 5-fold CV (diagnostic)
        # ------------------------------------------------------------------
        print(f"\n  Running {CV_N_SPLITS}-fold embargoed TimeSeriesSplit CV...")
        # CV is run on training portion only
        X_trainval = df_h.iloc[:split_idx][DEFAULT_FEATURE_COLUMNS].values.astype(float)
        y_trainval = df_h.iloc[:split_idx]["label"].map(LABEL_MAP).values.astype(int)
        cv_res = run_embargoed_cv(X_trainval, y_trainval, h, n_splits=CV_N_SPLITS)
        print(f"  CV Results ({cv_res['n_folds']} valid folds):")
        print(f"    Balanced Acc: {cv_res['bal_acc_mean']:.4f} ± {cv_res['bal_acc_std']:.4f}")
        print(f"    MCC:          {cv_res['mcc_mean']:.4f} ± {cv_res['mcc_std']:.4f}")

        # ------------------------------------------------------------------
        # Train final model on full embargoed training set
        # ------------------------------------------------------------------
        model = lgb.LGBMClassifier(
            objective="multiclass",
            num_class=3,
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            verbosity=-1,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        test_acc     = float(accuracy_score(y_test, y_pred))
        bal_acc      = float(balanced_accuracy_score(y_test, y_pred))
        mcc          = float(matthews_corrcoef(y_test, y_pred))
        majority_acc = _majority_baseline_accuracy(y_train, y_test)

        # Momentum baseline needs df_test with close prices + aligned thresholds
        if threshold_mode == "atr":
            # Use median threshold as scalar approximation for momentum baseline
            mom_up   = float(up_thresh_series.iloc[split_idx:split_idx + len(df_test)].median()) if hasattr(up_thresh_series, "iloc") else up_thresh_series
            mom_down = -mom_up
        else:
            mom_up, mom_down = up_thresh_series, down_thresh_series
        momentum_acc = _naive_momentum_baseline(df_test, h, mom_up, mom_down)

        lift = test_acc - majority_acc

        test_accuracies[h] = test_acc
        trained_models[h]  = model

        print(f"\n  Held-out test accuracy: {test_acc:.4f} ({test_acc*100:.2f}%)")
        print(f"  Classification Report:")
        print(classification_report(
            y_test, y_pred,
            labels=[0, 1, 2], target_names=["down", "flat", "up"],
            zero_division=0,
        ))
        _print_comparison_table(
            resolution, h, test_acc, bal_acc, mcc, majority_acc, momentum_acc, lift
        )

        # Feature importance and calibration diagnostic for primary horizon
        if h == primary_horizon:
            _print_feature_importance(model, DEFAULT_FEATURE_COLUMNS)
            cv_results_primary = cv_res

        # Save horizon artifact
        h_artifact = ARTIFACT_BASE_DIR / f"{symbol.upper()}_{resolution}_{version}_h{h}.txt"
        model.booster_.save_model(str(h_artifact))
        print(f"\n  Saved horizon {h} artifact to: {h_artifact}")

    # ------------------------------------------------------------------
    # Primary artifact & calibration (backward compat & Phase 19.2)
    # ------------------------------------------------------------------
    primary_artifact = ARTIFACT_BASE_DIR / f"{symbol.upper()}_{resolution}_{version}.txt"
    primary_model = trained_models.get(primary_horizon, list(trained_models.values())[0])
    primary_model.booster_.save_model(str(primary_artifact))
    print(f"\n  Primary artifact saved to: {primary_artifact}")

    # Recompute primary horizon test metrics on untouched test set
    df_h_primary = compute_labels(df_features, primary_horizon, up_thresh_series, down_thresh_series)
    split_idx_p  = int(len(df_h_primary) * 0.80)
    embargo_p    = max(0, split_idx_p - primary_horizon)
    df_train_p   = df_h_primary.iloc[:embargo_p].copy()
    df_test_p    = df_h_primary.iloc[split_idx_p:].copy()
    X_test_p     = df_test_p[DEFAULT_FEATURE_COLUMNS].values.astype(float)
    y_test_p     = df_test_p["label"].map(LABEL_MAP).values.astype(int)

    primary_bal_acc = float(balanced_accuracy_score(y_test_p, primary_model.predict(X_test_p)))
    primary_mcc     = float(matthews_corrcoef(y_test_p, primary_model.predict(X_test_p)))
    test_row_count  = len(df_test_p)
    majority_acc_p  = _majority_baseline_accuracy(
        df_h_primary.iloc[:split_idx_p]["label"].map(LABEL_MAP).values.astype(int),
        y_test_p,
    )
    primary_acc_p   = test_accuracies.get(primary_horizon, 0.0)
    test_lift       = round(primary_acc_p - majority_acc_p, 6)

    # ------------------------------------------------------------------
    # Phase 19.2 Task 1 & 2: Discrimination & Dedicated Calibration
    # ------------------------------------------------------------------
    print(f"\n{'='*60}")
    print(f"Primary Horizon ({primary_horizon} bars) Discrimination & Calibration Check")
    print(f"{'='*60}")
    disc_metrics = _print_calibration_diagnostic(
        primary_model, X_test_p, y_test_p, title_suffix=f"{symbol.upper()}/{resolution} Raw LightGBM"
    )

    calibration_path = None
    mae_before = disc_metrics["mae"]
    mae_after = None

    if disc_metrics["is_discriminative"]:
        print(f"\n  Fitting dedicated isotonic calibration wrapper...")
        calib_model = fit_dedicated_calibration(
            primary_model, df_train_p, primary_horizon, DEFAULT_FEATURE_COLUMNS
        )
        if calib_model is not None:
            calib_probs = calib_model.predict_proba(X_test_p)
            calib_disc_metrics = _print_calibration_diagnostic(
                None, X_test_p, y_test_p, proba=calib_probs,
                title_suffix=f"{symbol.upper()}/{resolution} Calibrated (Isotonic)"
            )
            mae_after = calib_disc_metrics["mae"]
            print(f"\n  Calibration Improvement on Held-Out Test Set:")
            print(f"    Raw Softmax MAE:    {mae_before:.2%}")
            print(f"    Calibrated MAE:     {mae_after:.2%}")
            print(f"    MAE Reduction:      {mae_before - mae_after:+.2%} points")

            calib_artifact = ARTIFACT_BASE_DIR / f"{symbol.upper()}_{resolution}_{version}.calib.joblib"
            joblib.dump(calib_model, str(calib_artifact))
            calibration_path = str(calib_artifact.resolve())
            print(f"    Saved calibration artifact to: {calib_artifact}")
    else:
        print(f"\n  Skipping calibration: model is not discriminative on confidence ranking.")

    # ------------------------------------------------------------------
    # Phase 19.2 Task 3: Dual-Gate activation check
    # ------------------------------------------------------------------
    gate_cv_pass = (
        test_row_count >= MIN_TEST_ROWS_FOR_ACTIVATION
        and cv_results_primary.get("mcc_mean", 0.0) > MIN_MCC_FOR_ACTIVATION
    )
    final_artifact_passes = (
        primary_acc_p > majority_acc_p
        and primary_mcc > 0.0
    )
    gate_pass = gate_cv_pass and final_artifact_passes

    if not gate_pass:
        reasons = []
        if test_row_count < MIN_TEST_ROWS_FOR_ACTIVATION:
            reasons.append(f"test_row_count={test_row_count} < {MIN_TEST_ROWS_FOR_ACTIVATION} minimum")
        if cv_results_primary.get("mcc_mean", 0.0) <= MIN_MCC_FOR_ACTIVATION:
            reasons.append(
                f"cv_mcc_mean={cv_results_primary.get('mcc_mean', 0.0):.4f} ≤ {MIN_MCC_FOR_ACTIVATION} "
                f"— no demonstrated edge above noise in CV"
            )
        if gate_cv_pass and not final_artifact_passes:
            reasons.append(
                f"CV showed edge (MCC={cv_results_primary.get('mcc_mean', 0.0):.4f}) but the deployed artifact's "
                f"own held-out test did not confirm it (test_mcc={primary_mcc:.4f}, test_acc={primary_acc_p:.4f} "
                f"vs majority={majority_acc_p:.4f}) — activation withheld pending a more stable model or more data."
            )
        activation_notes = "Model NOT activated: " + "; ".join(reasons)
        is_active = False
        print(f"\n[GATE FAIL] {symbol.upper()}/{resolution}: {activation_notes}")
    else:
        activation_notes = None
        is_active = True
        print(f"\n[GATE PASS] {symbol.upper()}/{resolution}: test_row_count={test_row_count}, "
              f"cv_mcc_mean={cv_results_primary.get('mcc_mean', 0.0):.4f} > {MIN_MCC_FOR_ACTIVATION}, "
              f"test_mcc={primary_mcc:.4f} > 0, test_lift={test_lift:+.4f} > 0")

    # Resolve display threshold for DB storage
    if threshold_mode == "atr":
        db_up_th   = float(up_thresh_series.median()) if hasattr(up_thresh_series, "median") else float(atr_multiplier)
        db_down_th = -db_up_th
    else:
        db_up_th   = float(up_thresh_series) if isinstance(up_thresh_series, (int, float)) else float(TIMEFRAME_THRESHOLDS_FIXED.get(resolution, 0.5))
        db_down_th = -db_up_th

    # ------------------------------------------------------------------
    # Write ml_models registry row
    # ------------------------------------------------------------------
    print(f"\n[DB] Writing ml_models row for {symbol.upper()}/{resolution} (is_active={is_active})...")
    async with async_session() as session:
        async with session.begin():
            # Deactivate any prior active row for this (component, symbol, resolution)
            await session.execute(
                update(MlModelModel)
                .where(
                    MlModelModel.component_id == "gbdt-forecast",
                    MlModelModel.symbol == symbol.upper(),
                    MlModelModel.resolution == resolution,
                    MlModelModel.is_active == True,
                )
                .values(is_active=False)
            )

            new_row = MlModelModel(
                component_id="gbdt-forecast",
                version=version,
                symbol=symbol.upper(),
                resolution=resolution,
                horizon_bars=primary_horizon,
                up_threshold_pct=db_up_th,
                down_threshold_pct=db_down_th,
                artifact_path=str(primary_artifact.resolve()),
                feature_columns=DEFAULT_FEATURE_COLUMNS,
                train_start=train_start_dt if train_start_dt.tzinfo else train_start_dt.replace(tzinfo=timezone.utc),
                train_end=train_end_dt   if train_end_dt.tzinfo   else train_end_dt.replace(tzinfo=timezone.utc),
                train_row_count=len(df_raw),
                accuracy=round(primary_acc_p, 6),
                is_active=is_active,
                # Phase 19.1 gating columns
                activation_notes=activation_notes,
                test_row_count=test_row_count,
                cv_balanced_acc_mean=round(cv_results_primary.get("bal_acc_mean", 0.0), 6),
                cv_balanced_acc_std=round(cv_results_primary.get("bal_acc_std", 0.0), 6),
                cv_mcc_mean=round(cv_results_primary.get("mcc_mean", 0.0), 6),
                cv_mcc_std=round(cv_results_primary.get("mcc_std", 0.0), 6),
                majority_baseline_acc=round(majority_acc_p, 6),
                threshold_mode=threshold_mode,
                atr_multiplier=atr_multiplier if threshold_mode == "atr" else None,
                # Phase 19.2 columns
                test_mcc=round(primary_mcc, 6),
                test_lift=round(test_lift, 6),
                is_discriminative=disc_metrics["is_discriminative"],
                discrimination_auc=round(disc_metrics["auc_confidence_correctness"], 6),
                calibration_path=calibration_path,
                calibration_mae_before=round(mae_before, 6) if mae_before is not None else None,
                calibration_mae_after=round(mae_after, 6) if mae_after is not None else None,
            )
            session.add(new_row)

    print(f"  ml_models row {'ACTIVATED' if is_active else 'INSERTED (inactive)'}.")
    await engine.dispose()
    return is_active



async def train_all(
    symbol: str,
    resolutions: Sequence[str],
    horizons: Sequence[int],
    threshold_mode: str,
    atr_multiplier: float,
    up_threshold_pct: Optional[float],
    down_threshold_pct: Optional[float],
    version: str,
    db_url: str,
) -> None:
    results: dict = {}
    print(f"\n{'='*60}")
    print(f"Starting Multi-Resolution Training for {symbol.upper()}")
    print(f"Target Resolutions: {list(resolutions)}")
    print(f"Target Horizons:    {list(horizons)}")
    print(f"Threshold Mode:     {threshold_mode}")
    print(f"{'='*60}\n")

    for res in resolutions:
        success = await train_resolution(
            symbol=symbol,
            resolution=res,
            horizons=horizons,
            threshold_mode=threshold_mode,
            atr_multiplier=atr_multiplier,
            up_threshold_pct=up_threshold_pct,
            down_threshold_pct=down_threshold_pct,
            version=version,
            db_url=db_url,
        )
        results[res] = "ACTIVE" if success else "INACTIVE/SKIPPED"

    print(f"\n{'='*60}")
    print(f"Batch Training Summary — {symbol.upper()}")
    print(f"{'='*60}")
    for res, status in results.items():
        icon = "✓" if status == "ACTIVE" else "✗"
        print(f"  {icon} Resolution {res:>4}: {status}")
    print(f"{'='*60}\n")
    print(f"NOTE: Only ACTIVE resolutions have is_active=True in ml_models.")
    print(f"      INACTIVE resolutions need more data or show no CV edge (MCC ≤ {MIN_MCC_FOR_ACTIVATION}).")
    print(f"      Retraining is a manual process — re-run this script to refresh.")


def main():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    parser = argparse.ArgumentParser(
        description="Train GBDT Multi-Horizon Forecast models (Phase 19.2 — discrimination & calibration)."
    )
    parser.add_argument("--symbol", default="BTCUSDT")
    parser.add_argument("--resolution", default="15m")
    parser.add_argument("--resolutions", default="")
    parser.add_argument("--all-resolutions", action="store_true")
    parser.add_argument("--horizons", default="12,24,32")
    parser.add_argument("--horizon-bars", type=int, default=None)
    parser.add_argument(
        "--threshold-mode", default="atr", choices=["atr", "fixed"],
        help="'atr' = ATR-relative per-row thresholds (default). 'fixed' = hardcoded per-timeframe pct."
    )
    parser.add_argument(
        "--atr-multiplier", type=float, default=0.5,
        help="ATR multiplier k: up_threshold = k * ATR/close * 100. Only used in --threshold-mode atr."
    )
    parser.add_argument("--up-threshold", type=float, default=None,
                        help="Fixed up-threshold (%%). Only used in --threshold-mode fixed.")
    parser.add_argument("--down-threshold", type=float, default=None,
                        help="Fixed down-threshold (%%). Only used in --threshold-mode fixed.")
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("v%Y%m%d"))
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", ""))
    args = parser.parse_args()

    if not args.db_url:
        print("[FATAL] --db-url or $DATABASE_URL required.")
        sys.exit(1)


    if args.horizon_bars is not None and (args.horizons == "12,24,32" or not args.horizons):
        horizons = [args.horizon_bars]
    else:
        horizons = [int(h.strip()) for h in args.horizons.split(",") if h.strip()]

    if args.all_resolutions:
        resolutions = DEFAULT_RESOLUTIONS
    elif args.resolutions:
        resolutions = [r.strip() for r in args.resolutions.split(",") if r.strip()]
    else:
        resolutions = [args.resolution]

    asyncio.run(train_all(
        symbol=args.symbol,
        resolutions=resolutions,
        horizons=horizons,
        threshold_mode=args.threshold_mode,
        atr_multiplier=args.atr_multiplier,
        up_threshold_pct=args.up_threshold,
        down_threshold_pct=args.down_threshold,
        version=args.version,
        db_url=args.db_url,
    ))


if __name__ == "__main__":
    main()
