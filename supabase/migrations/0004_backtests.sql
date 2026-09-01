create table public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','complete','error')),
  config jsonb not null,
  metrics jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.backtest_runs(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long','short')),
  entry_time timestamptz not null,
  exit_time timestamptz not null,
  size numeric not null,
  pnl numeric not null,
  pnl_pct numeric not null,
  trigger_node text not null,
  confidence numeric not null
);

create table public.equity_points (
  run_id uuid not null references public.backtest_runs(id) on delete cascade,
  ts timestamptz not null,
  equity numeric not null,
  benchmark numeric not null,
  drawdown numeric not null,
  primary key (run_id, ts)
);

alter table public.backtest_runs enable row level security;
alter table public.trades enable row level security;
alter table public.equity_points enable row level security;

create policy "backtest_runs CRUD by owner" on public.backtest_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trades readable via owned run" on public.trades
  for select using (exists (select 1 from public.backtest_runs r where r.id = run_id and r.user_id = auth.uid()));
create policy "equity_points readable via owned run" on public.equity_points
  for select using (exists (select 1 from public.backtest_runs r where r.id = run_id and r.user_id = auth.uid()));

-- The engine writes trades/equity_points using the service_role key, which bypasses RLS by design —
-- do not add insert policies for the anon/authenticated role on these two tables.

create index backtest_runs_bot_id_idx on public.backtest_runs(bot_id);
create index trades_run_id_idx on public.trades(run_id);
create index equity_points_run_id_idx on public.equity_points(run_id);
