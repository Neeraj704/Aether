create table public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled bot',
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','backtested','live','paused','error')),
  graph jsonb not null default '{"nodes":[],"edges":[],"notes":[],"frames":[],"schemaVersion":2}'::jsonb,
  headline_metric jsonb,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bot_versions (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  label text not null,
  note text not null default '',
  node_count integer not null default 0,
  graph jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.bots enable row level security;
alter table public.bot_versions enable row level security;

create policy "bots CRUD by owner" on public.bots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bot_versions readable via owned bot" on public.bot_versions
  for select using (exists (select 1 from public.bots b where b.id = bot_id and b.user_id = auth.uid()));
create policy "bot_versions insertable via owned bot" on public.bot_versions
  for insert with check (exists (select 1 from public.bots b where b.id = bot_id and b.user_id = auth.uid()));

create index bots_user_id_idx on public.bots(user_id);
create index bot_versions_bot_id_idx on public.bot_versions(bot_id);
