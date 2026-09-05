-- Phase 19.2: Add discrimination check, calibration, and final-artifact lift columns to ml_models.
--
-- These columns are written by the offline training script after:
--   1. Discrimination check (AUC of confidence ranking correctness > 0.55 and positive Spearman).
--   2. Dedicated-split isotonic calibration (if discriminative).
--   3. Dual-gate activation (CV edge + deployed-artifact held-out test lift).

alter table public.ml_models
    add column if not exists test_mcc               numeric,
    add column if not exists test_lift              numeric,
    add column if not exists is_discriminative      boolean not null default false,
    add column if not exists discrimination_auc     numeric,
    add column if not exists calibration_path       text,
    add column if not exists calibration_mae_before numeric,
    add column if not exists calibration_mae_after  numeric;

comment on column public.ml_models.test_mcc               is 'Matthews Correlation Coefficient evaluated on the deployed artifact''s own held-out test set.';
comment on column public.ml_models.test_lift              is 'Test accuracy minus majority-class baseline accuracy on held-out test set.';
comment on column public.ml_models.is_discriminative      is 'True if confidence-correctness AUC > 0.55 AND Spearman decile correlation is positive and non-trivial.';
comment on column public.ml_models.discrimination_auc     is 'Area under the ROC curve treating prediction correctness (0/1) as binary target and max confidence as score.';
comment on column public.ml_models.calibration_path       is 'File path to fitted CalibratedClassifierCV wrapper (if discriminative). NULL if non-discriminative.';
comment on column public.ml_models.calibration_mae_before is 'Mean Absolute Error across confidence deciles before calibration.';
comment on column public.ml_models.calibration_mae_after  is 'Mean Absolute Error across confidence deciles after calibration (evaluated on held-out test set).';
