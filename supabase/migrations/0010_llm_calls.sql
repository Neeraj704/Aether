create table if not exists public.llm_call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  run_id uuid references public.backtest_runs(id) on delete cascade,
  live_session_id uuid references public.live_sessions(id) on delete cascade,
  node_id text not null,
  component_id text not null,
  provider text not null,
  model text not null,
  status text not null check (status in ('ok','error','timeout','skipped_insufficient_credits','skipped_mode')),
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  credits_charged numeric not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.llm_call_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'llm_call_log' and policyname = 'llm_call_log readable by owner'
  ) then
    create policy "llm_call_log readable by owner" on public.llm_call_log
      for select using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists llm_call_log_user_idx on public.llm_call_log(user_id);
create index if not exists llm_call_log_bot_idx on public.llm_call_log(bot_id);
create index if not exists llm_call_log_run_idx on public.llm_call_log(run_id);
create index if not exists llm_call_log_session_idx on public.llm_call_log(live_session_id);
