-- Phase 19: ML Model Registry
--
-- Tracks trained model artifacts. The engine writes here after each offline training
-- run; inference nodes read the row marked `is_active` for their component_id to know
-- which artifact file to load. This is metadata only — the actual serialized model
-- (a .txt file in LightGBM native format) lives on the engine's local disk / persistent
-- volume, referenced by `artifact_path`. The "DB row + disk file" split is the standard
-- pattern for ML artifacts: the DB gives you queryable metadata and versioning history,
-- while the disk holds the binary/text artifact that is too large and too format-specific
-- to store in a relational column.
--
-- Only one row per (component_id, symbol, resolution) should have is_active = true at a time.
-- This is enforced in application code in the training script (the script unsets the previous
-- active row in the same transaction that sets the new one active). A partial unique index
-- would be a reasonable future hardening; omitted here to keep the migration minimal.
-- See: apps/engine/app/ml/train_gbdt_forecast.py for the application-level enforcement.

create table public.ml_models (
  id uuid primary key default gen_random_uuid(),
  component_id text not null,             -- e.g. 'gbdt-forecast'
  version text not null,                  -- e.g. 'v1' or ISO-date stamp
  symbol text not null,                   -- trained per-symbol, e.g. 'BTCUSDT'
  resolution text not null,               -- e.g. '15m' — must match the bot's candle resolution to be valid
  horizon_bars int not null,              -- how many bars ahead the model predicts, e.g. 12
  up_threshold_pct numeric not null,      -- e.g. 0.5 (%) — return above this over horizon_bars labeled 'up'
  down_threshold_pct numeric not null,    -- e.g. -0.5 (%) — return below this labeled 'down'; between is 'flat'
  artifact_path text not null,            -- absolute path on the engine's filesystem/volume
  feature_columns text[] not null,        -- exact ordered list of feature names the model expects at inference time
  train_start timestamptz not null,
  train_end timestamptz not null,
  train_row_count int not null,
  accuracy numeric,                       -- held-out test accuracy, informational only; see per-class breakdown in stdout
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Composite index supporting the inference node's lookup pattern:
-- WHERE component_id = 'gbdt-forecast' AND symbol = 'BTCUSDT' AND resolution = '15m' AND is_active = true
create index ml_models_component_symbol_idx on public.ml_models (component_id, symbol, resolution, is_active);

alter table public.ml_models enable row level security;

-- Any authenticated user can read model metadata (e.g. to display the model version in the UI).
-- Only the offline training script (running with service-role key) may insert or update rows.
create policy "ml_models readable by authenticated users" on public.ml_models
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy for anon/authenticated users — service-role writes only,
-- same pattern as `candles` (seeded by binance_ingest.py via service-role connection).
