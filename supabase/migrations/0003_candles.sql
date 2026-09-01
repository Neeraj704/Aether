create table public.candles (
  symbol text not null,
  resolution text not null,
  open_time timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null,
  primary key (symbol, resolution, open_time)
);
create index candles_symbol_res_time_idx on public.candles (symbol, resolution, open_time);
-- No RLS: this is shared, non-user-owned reference data, read by the engine's service role only.
alter table public.candles enable row level security;
create policy "candles readable by anyone authenticated" on public.candles for select using (auth.role() = 'authenticated');
