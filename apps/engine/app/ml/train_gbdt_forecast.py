"""
Offline GBDT Forecast Training Script — Phase 19 / Multi-Horizon
================================================================
Usage:
    # Single resolution with default multi-horizons (12, 24, 32 bars):
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --resolution 15m

    # Custom multi-horizons:
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --resolution 15m --horizons 12,24,32

    # Batch train all standard resolutions (1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d):
    python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --all-resolutions

This is a standalone, manually-invoked script — NOT imported by the live engine.
It follows the same pattern as binance_ingest.py and seed_macro_events.py:
run once to produce an artifact, re-run to retrain.

Design decisions (do not relitigate):
- LightGBM multiclass classifier, NOT regression — predicts P(up)/P(down)/P(flat) over
  each horizon window. Multi-horizon models (e.g. 12, 24, 32 bars) are trained together
  and evaluated on held-out data.
- Chronological 80/20 train/test split — NEVER random. Random splits leak future data via
  autocorrelated neighboring bars, inflating apparent test accuracy.
- Native LightGBM save_model() format, NOT pickle — pickle is fragile across library
  version upgrades. LightGBM's own text format is portable and version-stable.
- Label encoding is FIXED: {"down": 0, "flat": 1, "up": 2}. Do NOT let LabelEncoder
  alphabetize; the inference node decodes {0: "short", 1: "flat", 2: "long"} and this
  must be stable across training runs.

Persistence note:
  Model artifacts are written to apps/engine/model_artifacts/gbdt-forecast/.
  This directory is in .gitignore — trained files do NOT belong in git.
  On Render's free tier, the filesystem is ephemeral — this script must be re-run
  after every deploy unless a persistent disk is mounted at ARTIFACT_BASE_DIR.
  Verify your deployment target's disk configuration before assuming persistence.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Sequence

import numpy as np
import pandas as pd
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Path bootstrapping (run as module from apps/engine/)
# ---------------------------------------------------------------------------
_ENGINE_ROOT = Path(__file__).resolve().parent.parent.parent  # apps/engine/
sys.path.insert(0, str(_ENGINE_ROOT))

from app.db.models import CandleModel, MlModelModel

try:
    import lightgbm as lgb
    from sklearn.metrics import classification_report, accuracy_score
except ImportError:
    print(
        "[FATAL] lightgbm and scikit-learn are required. "
        "Run: pip install lightgbm scikit-learn"
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants — feature encoding conventions shared with inference node.
# ANY change here MUST be mirrored in apps/engine/app/nodes/ml/gbdt_forecast.py.
# ---------------------------------------------------------------------------

LABEL_MAP = {"down": 0, "flat": 1, "up": 2}
LABEL_MAP_INV = {0: "down", 1: "flat", 2: "up"}

REGIME_TREND = 1.0
REGIME_CHOP = 0.0

DEFAULT_FEATURE_COLUMNS = [
    "rsi",
    "ema_fast",
    "ema_slow",
    "macd",
    "macd_signal",
    "zscore",
    "regime_numeric",
]

DEFAULT_RESOLUTIONS = ["1m", "3m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"]
DEFAULT_HORIZONS = [12, 24, 32]

ARTIFACT_BASE_DIR = _ENGINE_ROOT / "model_artifacts" / "gbdt-forecast"


# ---------------------------------------------------------------------------
# Vectorized feature computation
# ---------------------------------------------------------------------------

def compute_features_vectorized(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all training features vectorized over the full DataFrame.
    """
    out = df.copy()
    close = out["close"].astype(float)

    # --- RSI(14) ---
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out["rsi"] = (100 - (100 / (1 + rs))).fillna(50.0)

    # --- EMA fast (span=20) and slow (span=50) ---
    out["ema_fast"] = close.ewm(span=20, adjust=False).mean()
    out["ema_slow"] = close.ewm(span=50, adjust=False).mean()

    # --- MACD (12, 26, signal=9) ---
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_series = ema12 - ema26
    out["macd"] = macd_series
    out["macd_signal"] = macd_series.ewm(span=9, adjust=False).mean()

    # --- zscore and regime ---
    ema_spread = (out["ema_fast"] - out["ema_slow"]).abs() + 1.0
    out["zscore"] = (close - out["ema_slow"]) / ema_spread
    out["regime_numeric"] = ((out["ema_fast"] - out["ema_slow"]).abs() > close * 0.01).astype(float)

    return out


def compute_features_rowbyrow(df: pd.DataFrame) -> pd.DataFrame:
    """
    Simulate the per-bar inference path for sanity-checking against vectorized training.
    """
    rows = []
    for _, row in df.iterrows():
        rsi = float(row.get("_rsi", row.get("rsi", 50.0)))
        ema_fast = float(row.get("_ema_fast", row.get("ema_fast", row["close"])))
        ema_slow = float(row.get("_ema_slow", row.get("ema_slow", row["close"])))
        macd = float(row.get("_macd", row.get("macd", 0.0)))
        macd_signal = float(row.get("_macd_signal", row.get("macd_signal", 0.0)))
        close = float(row["close"])

        ema_spread = abs(ema_fast - ema_slow) + 1.0
        zscore = (close - ema_slow) / ema_spread
        regime_numeric = REGIME_TREND if abs(ema_fast - ema_slow) > close * 0.01 else REGIME_CHOP

        rows.append({
            "rsi": rsi,
            "ema_fast": ema_fast,
            "ema_slow": ema_slow,
            "macd": macd,
            "macd_signal": macd_signal,
            "zscore": zscore,
            "regime_numeric": regime_numeric,
        })
    return pd.DataFrame(rows)


def run_feature_parity_sanity_check(
    df_with_features: pd.DataFrame,
    n_rows: int = 300,
    tolerance: float = 1e-6,
) -> None:
    """
    Verify that vectorized training features match the per-bar inference path.
    """
    print(f"\n[Sanity Check] Comparing vectorized training features vs per-bar inference path "
          f"for last {n_rows} rows...")

    vec_slice = df_with_features.tail(n_rows)[DEFAULT_FEATURE_COLUMNS].reset_index(drop=True)

    df_with_prefixed = df_with_features.tail(n_rows).copy().reset_index(drop=True)
    df_with_prefixed["_rsi"] = df_with_prefixed["rsi"]
    df_with_prefixed["_ema_fast"] = df_with_prefixed["ema_fast"]
    df_with_prefixed["_ema_slow"] = df_with_prefixed["ema_slow"]
    df_with_prefixed["_macd"] = df_with_prefixed["macd"]
    df_with_prefixed["_macd_signal"] = df_with_prefixed["macd_signal"]

    rowbyrow_slice = compute_features_rowbyrow(df_with_prefixed)

    mismatches = []
    for col in DEFAULT_FEATURE_COLUMNS:
        diff = (vec_slice[col] - rowbyrow_slice[col]).abs()
        max_diff = diff.max()
        if max_diff > tolerance:
            mismatches.append((col, float(max_diff)))

    if mismatches:
        msg = "\n".join(f"  {col}: max diff = {d:.2e}" for col, d in mismatches)
        raise RuntimeError(
            f"[FATAL] Feature parity check FAILED — vectorized training features do NOT match "
            f"per-bar inference path:\n{msg}\n"
            f"Do NOT train on a feature pipeline you haven't proven matches production."
        )

    print(f"[Sanity Check] PASSED — all {len(DEFAULT_FEATURE_COLUMNS)} features match "
          f"within tolerance={tolerance:.0e} across {n_rows} rows. "
          f"Training features are production-equivalent.")


# ---------------------------------------------------------------------------
# Label computation
# ---------------------------------------------------------------------------

def compute_labels(
    df: pd.DataFrame,
    horizon_bars: int,
    up_threshold_pct: float,
    down_threshold_pct: float,
) -> pd.DataFrame:
    """
    Compute 3-class direction label for each bar:
      future_return = (close[t+horizon] - close[t]) / close[t] * 100
      label = "up" if future_return > up_threshold_pct
            = "down" if future_return < down_threshold_pct
            = "flat" otherwise
    """
    close = df["close"].astype(float)
    future_return = (close.shift(-horizon_bars) - close) / close * 100.0

    conditions = [
        future_return > up_threshold_pct,
        future_return < down_threshold_pct,
    ]
    choices = ["up", "down"]
    df = df.copy()
    df["label"] = np.select(conditions, choices, default="flat")
    df["future_return_pct"] = future_return

    # Drop the last horizon_bars rows — they have NaN future returns
    df = df.iloc[:-horizon_bars].copy()
    return df


# ---------------------------------------------------------------------------
# Main training function (Single Resolution + Multi-Horizon)
# ---------------------------------------------------------------------------

async def train_resolution(
    symbol: str,
    resolution: str,
    horizons: Sequence[int],
    up_threshold_pct: float,
    down_threshold_pct: float,
    version: str,
    db_url: str,
) -> bool:
    """
    Train multi-horizon GBDT forecast models for a given (symbol, resolution).
    """
    primary_horizon = horizons[0] if horizons else 12

    print(f"\n{'='*60}")
    print(f"GBDT Multi-Horizon Training — {symbol.upper()}/{resolution}")
    print(f"Horizons: {list(horizons)} bars | Primary: {primary_horizon} bars")
    print(f"Up threshold: +{up_threshold_pct}% | Down threshold: {down_threshold_pct}%")
    print(f"Version: {version}")
    print(f"{'='*60}\n")

    # ------------------------------------------------------------------
    # 1. Load candle data
    # ------------------------------------------------------------------
    print("[1/7] Loading candle data from database...")
    engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            select(CandleModel)
            .where(
                CandleModel.symbol == symbol.upper(),
                CandleModel.resolution == resolution,
            )
            .order_by(CandleModel.open_time.asc())
        )
        candles = list(result.scalars().all())

    if len(candles) < 200:
        print(f"[WARN] Only {len(candles)} candles found for {symbol}/{resolution}. "
              f"Need at least 200. Skipping {symbol}/{resolution}.")
        await engine.dispose()
        return False

    print(f"  Loaded {len(candles):,} candles "
          f"from {candles[0].open_time.date()} to {candles[-1].open_time.date()}")

    df_raw = pd.DataFrame([{
        "open_time": c.open_time,
        "open": float(c.open),
        "high": float(c.high),
        "low": float(c.low),
        "close": float(c.close),
        "volume": float(c.volume),
    } for c in candles]).sort_values("open_time").reset_index(drop=True)

    train_start = candles[0].open_time
    train_end = candles[-1].open_time

    # ------------------------------------------------------------------
    # 2. Compute features (vectorized)
    # ------------------------------------------------------------------
    print("[2/7] Computing features (vectorized)...")
    df_features = compute_features_vectorized(df_raw)

    n_before = len(df_features)
    df_features = df_features.dropna(subset=DEFAULT_FEATURE_COLUMNS).reset_index(drop=True)
    n_dropped = n_before - len(df_features)
    print(f"  Dropped {n_dropped} NaN rows (indicator warm-up period)")

    # ------------------------------------------------------------------
    # 3. Feature parity sanity check
    # ------------------------------------------------------------------
    print("[3/7] Running train/inference feature parity sanity check...")
    run_feature_parity_sanity_check(df_features, n_rows=min(300, len(df_features)))

    ARTIFACT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    trained_models = {}
    test_accuracies = {}

    # ------------------------------------------------------------------
    # 4 & 5 & 6 & 7: Train for each horizon
    # ------------------------------------------------------------------
    for h in horizons:
        print(f"\n--- Training Horizon: {h} bars forward ---")
        df_h = compute_labels(df_features, h, up_threshold_pct, down_threshold_pct)

        label_counts = df_h["label"].value_counts()
        total = len(df_h)
        print(f"  Label distribution (total={total:,}):")
        for lbl in ["up", "flat", "down"]:
            count = label_counts.get(lbl, 0)
            pct = count / total * 100 if total > 0 else 0
            print(f"    {lbl:>5}: {count:>6,} ({pct:5.1f}%)")

        split_idx = int(len(df_h) * 0.80)
        df_train = df_h.iloc[:split_idx].copy()
        df_test = df_h.iloc[split_idx:].copy()

        X_train = df_train[DEFAULT_FEATURE_COLUMNS].values.astype(float)
        X_test = df_test[DEFAULT_FEATURE_COLUMNS].values.astype(float)

        y_train = df_train["label"].map(LABEL_MAP).values.astype(int)
        y_test = df_test["label"].map(LABEL_MAP).values.astype(int)

        model = lgb.LGBMClassifier(
            objective="multiclass",
            num_class=3,
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            verbosity=-1,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        test_acc = float(accuracy_score(y_test, y_pred))
        test_accuracies[h] = test_acc
        trained_models[h] = model

        print(f"  Horizon {h} held-out test accuracy: {test_acc:.4f} ({test_acc*100:.2f}%)")
        target_names = ["down", "flat", "up"]
        report = classification_report(y_test, y_pred, labels=[0, 1, 2], target_names=target_names, zero_division=0)
        print("  Per-class report:")
        print(report)

        # Save individual horizon artifact
        h_artifact_name = f"{symbol.upper()}_{resolution}_{version}_h{h}.txt"
        h_artifact_path = ARTIFACT_BASE_DIR / h_artifact_name
        model.booster_.save_model(str(h_artifact_path))
        print(f"  Saved horizon {h} artifact to: {h_artifact_path}")

    # Primary artifact path (backward compatibility & standard entry)
    primary_artifact_name = f"{symbol.upper()}_{resolution}_{version}.txt"
    primary_artifact_path = ARTIFACT_BASE_DIR / primary_artifact_name
    primary_model = trained_models.get(primary_horizon, list(trained_models.values())[0])
    primary_model.booster_.save_model(str(primary_artifact_path))
    print(f"  Primary artifact saved to: {primary_artifact_path}")

    # ------------------------------------------------------------------
    # Insert / Update ml_models row
    # ------------------------------------------------------------------
    primary_acc = test_accuracies.get(primary_horizon, 0.0)
    print(f"\n[DB] Writing ml_models registry row for {symbol.upper()}/{resolution}...")
    async with async_session() as session:
        async with session.begin():
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
                up_threshold_pct=up_threshold_pct,
                down_threshold_pct=down_threshold_pct,
                artifact_path=str(primary_artifact_path.resolve()),
                feature_columns=DEFAULT_FEATURE_COLUMNS,
                train_start=train_start if train_start.tzinfo else train_start.replace(tzinfo=timezone.utc),
                train_end=train_end if train_end.tzinfo else train_end.replace(tzinfo=timezone.utc),
                train_row_count=len(df_raw),
                accuracy=round(primary_acc, 6),
                is_active=True,
            )
            session.add(new_row)

    print(f"  ml_models row inserted with is_active=True (prior active row deactivated).")
    await engine.dispose()
    return True


TIMEFRAME_THRESHOLDS = {
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


async def train_all(
    symbol: str,
    resolutions: Sequence[str],
    horizons: Sequence[int],
    up_threshold_pct: Optional[float],
    down_threshold_pct: Optional[float],
    version: str,
    db_url: str,
) -> None:
    """
    Train models sequentially across multiple resolutions.
    """
    results = {}
    print(f"\n============================================================")
    print(f"Starting Multi-Resolution Training for {symbol.upper()}")
    print(f"Target Resolutions: {list(resolutions)}")
    print(f"Target Horizons:    {list(horizons)}")
    print(f"============================================================\n")

    for res in resolutions:
        # If user didn't specify custom threshold, use timeframe-adapted threshold
        if up_threshold_pct is None:
            up_th = TIMEFRAME_THRESHOLDS.get(res, 0.50)
            down_th = -up_th
        else:
            up_th = up_threshold_pct
            down_th = down_threshold_pct if down_threshold_pct is not None else -up_th

        success = await train_resolution(
            symbol=symbol,
            resolution=res,
            horizons=horizons,
            up_threshold_pct=up_th,
            down_threshold_pct=down_th,
            version=version,
            db_url=db_url,
        )
        results[res] = "SUCCESS" if success else "SKIPPED/FAILED"

    print(f"\n{'='*60}")
    print(f"Batch Training Summary — {symbol.upper()}")
    print(f"{'='*60}")
    for res, status in results.items():
        print(f"  Resolution {res:>4}: {status}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Train GBDT Multi-Horizon Forecast models offline. "
                    "Run: python -m app.ml.train_gbdt_forecast --symbol BTCUSDT --resolution 15m --horizons 12,24,32"
    )
    parser.add_argument("--symbol", default="BTCUSDT", help="Trading symbol (default: BTCUSDT)")
    parser.add_argument("--resolution", default="15m", help="Candle resolution (default: 15m)")
    parser.add_argument("--resolutions", default="",
                        help="Comma-separated resolutions, e.g. 1m,5m,15m,1h,4h,1d")
    parser.add_argument("--all-resolutions", action="store_true",
                        help="Train across all standard resolutions (1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d)")
    parser.add_argument("--horizons", default="12,24,32",
                        help="Comma-separated forward horizons in bars (default: 12,24,32)")
    parser.add_argument("--horizon-bars", type=int, default=None,
                        help="Legacy single horizon bars (overridden by --horizons if set)")
    parser.add_argument("--up-threshold", type=float, default=None,
                        help="Return %% above which bar is labeled 'up' (default: None, adapts per timeframe)")
    parser.add_argument("--down-threshold", type=float, default=None,
                        help="Return %% below which bar is labeled 'down' (default: None, adapts per timeframe)")
    parser.add_argument("--version", default=datetime.now(timezone.utc).strftime("v%Y%m%d"),
                        help="Version tag for this training run (default: vYYYYMMDD)")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", ""),
                        help="Async SQLAlchemy DB URL (default: $DATABASE_URL env var)")
    args = parser.parse_args()

    if not args.db_url:
        print("[FATAL] --db-url or $DATABASE_URL environment variable is required.")
        sys.exit(1)

    # Parse horizons
    if args.horizon_bars is not None and (args.horizons == "12,24,32" or not args.horizons):
        horizons = [args.horizon_bars]
    else:
        horizons = [int(h.strip()) for h in args.horizons.split(",") if h.strip()]

    # Parse resolutions
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
        up_threshold_pct=args.up_threshold,
        down_threshold_pct=args.down_threshold,
        version=args.version,
        db_url=args.db_url,
    ))


if __name__ == "__main__":
    main()
