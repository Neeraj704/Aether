-- Migration: 0009_billing.sql
-- Description: Subscriptions, credit wallets, credit transactions, payments, and server-side entitlement checks.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','pro','elite')),
  status text not null default 'active' check (status in ('active','cancelled','past_due')),
  razorpay_subscription_id text,
  razorpay_customer_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,        -- positive = credit, negative = debit
  reason text not null,            -- 'topup', 'live_tick', 'backtest_run', 'refund', etc.
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  razorpay_signature text,
  amount numeric not null,
  currency text not null default 'INR',
  kind text not null check (kind in ('subscription','credit_topup')),
  status text not null default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.payments enable row level security;

-- Policies: Authenticated users can read their own billing records
drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own" on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "wallets read own" on public.credit_wallets;
create policy "wallets read own" on public.credit_wallets for select using (auth.uid() = user_id);

drop policy if exists "transactions read own" on public.credit_transactions;
create policy "transactions read own" on public.credit_transactions for select using (auth.uid() = user_id);

drop policy if exists "payments read own" on public.payments;
create policy "payments read own" on public.payments for select using (auth.uid() = user_id);

-- Indexes for efficient queries
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists credit_transactions_user_idx on public.credit_transactions(user_id);
create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_order_idx on public.payments(razorpay_order_id);

-- Server-side trigger: enforce that publishing a paid marketplace preset (price > 0)
-- requires the creator to have an active Pro / Elite subscription.
create or replace function public.check_paid_listing_tier()
returns trigger
language plpgsql
security definer
as $$
declare
  user_plan text;
begin
  if new.price > 0 then
    select coalesce(plan, 'free') into user_plan
    from public.subscriptions
    where user_id = new.owner_id;

    if user_plan is null or user_plan = 'free' then
      raise exception 'Selling paid presets requires an active Pro subscription';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_paid_listing_tier on public.marketplace_listings;
create trigger trg_check_paid_listing_tier
before insert or update on public.marketplace_listings
for each row execute function public.check_paid_listing_tier();
