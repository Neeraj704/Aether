-- Real crypto news headlines, fetched on a schedule, kept for both live sentiment
-- scoring and historical-backtest replay (read by timestamp range, same pattern as candles).
create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- e.g. 'cryptocompare'
  external_id text not null,             -- the source's own article id, for dedup
  title text not null,
  body_snippet text not null default '',
  url text not null,
  published_at timestamptz not null,
  symbols text[] not null default '{}',  -- e.g. {'BTC','ETH'} — tagged assets, from the source's own categorization
  sentiment_compound numeric,             -- VADER compound score, -1.0 to 1.0, computed at ingest time
  sentiment_pos numeric,
  sentiment_neg numeric,
  sentiment_neu numeric,
  fetched_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists news_items_published_at_idx on public.news_items (published_at desc);
create index if not exists news_items_symbols_idx on public.news_items using gin (symbols);

alter table public.news_items enable row level security;
create policy "news_items readable by anyone authenticated" on public.news_items
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policy for anon/authenticated — only the engine's service-role
-- ingestion job writes here, same pattern as `candles`.

-- Curated, high-impact recurring US macro events. Seeded manually, not scraped from a
-- live calendar API — see Phase 17 prompt §3 for why. `impact` is always 'high' for
-- entries in this table; this table is deliberately narrow-scope, not a general calendar.
create table if not exists public.macro_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('fomc_meeting','cpi_release','nfp_release')),
  label text not null,                   -- e.g. 'FOMC Meeting Decision', 'US CPI Release (MoM)'
  scheduled_at timestamptz not null,      -- the announcement time, UTC
  blackout_before_minutes int not null default 60,
  blackout_after_minutes int not null default 60,
  created_at timestamptz not null default now(),
  unique (event_type, scheduled_at)
);

create index if not exists macro_events_scheduled_at_idx on public.macro_events (scheduled_at);

alter table public.macro_events enable row level security;
create policy "macro_events readable by anyone authenticated" on public.macro_events
  for select using (auth.role() = 'authenticated');
