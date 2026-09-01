-- Migration: 0006_live_trading.sql
-- Description: Persisted live paper-trading state, sessions, execution trades, and equity curve tracking.

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running','stopped','error')),
  symbol text not null,
  capital numeric not null,
  cash numeric not null,
  equity numeric not null,
  position jsonb,               -- null when flat; {side,size,entry_price,entry_time,stop_price,confidence} when open
  peak_equity numeric not null,
  max_drawdown numeric not null default 0,
  last_bar_time timestamptz,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  error_message text
);

create table if not exists public.live_trades (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('long','short')),
  entry_time timestamptz not null,
  exit_time timestamptz not null,
  size numeric not null,
  pnl numeric not null,
  pnl_pct numeric not null,
  trigger_node text not null,
  confidence numeric not null,
  execution_flow jsonb
);

create table if not exists public.live_equity_points (
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  ts timestamptz not null,
  equity numeric not null,
  drawdown numeric not null,
  primary key (live_session_id, ts)
);

alter table public.live_sessions enable row level security;
alter table public.live_trades enable row level security;
alter table public.live_equity_points enable row level security;

-- Policies
drop policy if exists "live_sessions CRUD by owner" on public.live_sessions;
create policy "live_sessions CRUD by owner" on public.live_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "live_trades readable via owned session" on public.live_trades;
create policy "live_trades readable via owned session" on public.live_trades
  for select using (exists (select 1 from public.live_sessions s where s.id = live_session_id and s.user_id = auth.uid()));

drop policy if exists "live_equity_points readable via owned session" on public.live_equity_points;
create policy "live_equity_points readable via owned session" on public.live_equity_points
  for select using (exists (select 1 from public.live_sessions s where s.id = live_session_id and s.user_id = auth.uid()));

create unique index if not exists live_sessions_one_active_per_bot on public.live_sessions(bot_id) where status = 'running';
create index if not exists live_trades_session_idx on public.live_trades(live_session_id);
create index if not exists live_equity_points_session_idx on public.live_equity_points(live_session_id);
