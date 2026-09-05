-- Phase 19.1: Add gating and honest-metrics columns to ml_models.
-- These columns are written by the offline training script after embargoed
-- TimeSeriesSplit cross-validation and registry gating checks.
--
-- Gating logic (enforced in application code, not DB constraints):
--   - is_active = true ONLY IF:
--       test_row_count >= 500 (minimum for statistically meaningful evaluation)
--       AND cv_mcc_mean > 0.02 (MCC clearly above noise, not a high bar — just
--       excluding models indistinguishable from a coin flip)
--   - Otherwise is_active = false with activation_notes explaining why.
--
-- Cross-validation metrics are from embargoed 5-fold TimeSeriesSplit (each fold's
-- train tail is trimmed by horizon_bars rows to prevent label leakage across folds,
-- mirroring the same embargo applied to the final train/test split in Phase 19.1 Task 2).

alter table public.ml_models
    add column if not exists activation_notes     text,
    add column if not exists test_row_count        int,
    add column if not exists cv_balanced_acc_mean  numeric,
    add column if not exists cv_balanced_acc_std   numeric,
    add column if not exists cv_mcc_mean           numeric,
    add column if not exists cv_mcc_std            numeric,
    add column if not exists majority_baseline_acc numeric,
    add column if not exists threshold_mode        text default 'atr',
    add column if not exists atr_multiplier        numeric;

comment on column public.ml_models.activation_notes     is 'Human-readable reason this model row is inactive (e.g. insufficient test rows, no CV edge). NULL for active rows.';
comment on column public.ml_models.test_row_count        is 'Number of rows in the held-out test set (20% chronological split after embargo).';
comment on column public.ml_models.cv_balanced_acc_mean  is 'Mean balanced accuracy across 5 embargoed TimeSeriesSplit folds.';
comment on column public.ml_models.cv_balanced_acc_std   is 'Std-dev of balanced accuracy across 5 embargoed TimeSeriesSplit folds.';
comment on column public.ml_models.cv_mcc_mean           is 'Mean Matthews Correlation Coefficient across 5 embargoed TimeSeriesSplit folds.';
comment on column public.ml_models.cv_mcc_std            is 'Std-dev of MCC across 5 embargoed TimeSeriesSplit folds.';
comment on column public.ml_models.majority_baseline_acc is 'Accuracy of a trivial majority-class predictor on the test set (baseline to beat).';
comment on column public.ml_models.threshold_mode        is '"atr" (ATR-relative per-row thresholds) or "fixed" (per-timeframe fixed percentage).';
comment on column public.ml_models.atr_multiplier        is 'ATR multiplier k used for ATR-relative labeling (up_threshold = k * atr_pct).';
