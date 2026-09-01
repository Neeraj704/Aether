create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  plan text not null default 'free' check (plan in ('free','starter','pro','payg')),
  credits integer not null default 240,
  public_profile boolean not null default false,
  avatar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by owner"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are updatable by owner"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
