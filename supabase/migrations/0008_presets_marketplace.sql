-- Migration: 0008_presets_marketplace.sql
-- Description: Presets, versioning, marketplace listings, reviews, clone counters & review stats triggers.

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  graph jsonb not null default '{"nodes":[],"edges":[],"notes":[],"frames":[],"schemaVersion":2}'::jsonb,
  node_count int not null default 0,
  layers text[] not null default '{}',
  published_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preset_versions (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  label text not null,
  note text not null default '',
  graph jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid references public.presets(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  author_notes text not null default '',
  category text not null default 'other',
  tags text[] not null default '{}',
  price numeric not null default 0,
  tier text not null default 'free',
  graph jsonb not null default '{"nodes":[],"edges":[],"notes":[],"frames":[],"schemaVersion":2}'::jsonb,
  node_count int not null default 0,
  layers text[] not null default '{}',
  sample_run_id uuid,
  clones int not null default 0,
  revenue numeric not null default 0,
  rating numeric not null default 0,
  review_count int not null default 0,
  status text not null default 'published' check (status in ('published','unpublished')),
  published_at timestamptz not null default now()
);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (listing_id, reviewer_id)
);

-- Enable RLS
alter table public.presets enable row level security;
alter table public.preset_versions enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_reviews enable row level security;

-- Presets policies
drop policy if exists "presets owner CRUD" on public.presets;
create policy "presets owner CRUD" on public.presets for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "preset_versions via owned preset" on public.preset_versions;
create policy "preset_versions via owned preset" on public.preset_versions for all
  using (exists (select 1 from public.presets p where p.id = preset_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.presets p where p.id = preset_id and p.owner_id = auth.uid()));

-- Marketplace listings policies
-- Anyone (incl. anonymous, for the public /marketplace pages) can read published ones.
drop policy if exists "listings public read" on public.marketplace_listings;
create policy "listings public read" on public.marketplace_listings for select
  using (status = 'published' or auth.uid() = owner_id);

drop policy if exists "listings owner insert" on public.marketplace_listings;
create policy "listings owner insert" on public.marketplace_listings for insert
  with check (auth.uid() = owner_id);

drop policy if exists "listings owner update" on public.marketplace_listings;
create policy "listings owner update" on public.marketplace_listings for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Marketplace reviews policies
drop policy if exists "reviews public read" on public.marketplace_reviews;
create policy "reviews public read" on public.marketplace_reviews for select
  using (true);

drop policy if exists "reviews authed insert" on public.marketplace_reviews;
create policy "reviews authed insert" on public.marketplace_reviews for insert
  with check (auth.uid() = reviewer_id);

drop policy if exists "reviews authed update" on public.marketplace_reviews;
create policy "reviews authed update" on public.marketplace_reviews for update
  using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

-- Public read for profiles (so creator details / handles show on listings)
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select
  using (true);

-- Allow public read on sample backtest runs for published listings
drop policy if exists "backtest_runs public read for published listings" on public.backtest_runs;
create policy "backtest_runs public read for published listings" on public.backtest_runs
  for select using (exists (select 1 from public.marketplace_listings l where l.sample_run_id = id and l.status = 'published'));

drop policy if exists "equity_points public read for published listings" on public.equity_points;
create policy "equity_points public read for published listings" on public.equity_points
  for select using (exists (select 1 from public.marketplace_listings l where l.sample_run_id = run_id and l.status = 'published'));

-- Indexes
create index if not exists presets_owner_idx on public.presets(owner_id);
create index if not exists preset_versions_preset_id_idx on public.preset_versions(preset_id);
create index if not exists listings_status_idx on public.marketplace_listings(status);
create index if not exists listings_owner_idx on public.marketplace_listings(owner_id);
create index if not exists listings_preset_id_idx on public.marketplace_listings(preset_id);
create index if not exists reviews_listing_idx on public.marketplace_reviews(listing_id);
create index if not exists reviews_reviewer_idx on public.marketplace_reviews(reviewer_id);

-- Atomic clone counter RPC (security definer so callers can atomically increment clone count)
create or replace function public.increment_listing_clones(listing_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.marketplace_listings
  set clones = clones + 1
  where id = listing_id;
end;
$$;

-- Automatic trigger function for maintaining listing review rating and review_count
create or replace function public.update_listing_review_stats()
returns trigger
language plpgsql
security definer
as $$
declare
  target_id uuid;
  avg_r numeric;
  cnt int;
begin
  if tg_op = 'DELETE' then
    target_id := old.listing_id;
  else
    target_id := new.listing_id;
  end if;

  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
  into avg_r, cnt
  from public.marketplace_reviews
  where listing_id = target_id;

  update public.marketplace_listings
  set rating = avg_r, review_count = cnt
  where id = target_id;

  return null;
end;
$$;

drop trigger if exists trg_update_listing_review_stats on public.marketplace_reviews;
create trigger trg_update_listing_review_stats
after insert or update or delete on public.marketplace_reviews
for each row execute function public.update_listing_review_stats();
