create table if not exists public.user_provider_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);

alter table public.user_provider_keys enable row level security;

-- Deliberately NO select/insert/update/delete policy for anon or authenticated roles.
-- A user's own API key for a third-party LLM provider is never read back to the browser in
-- plaintext, not even by its owner, for the same reason payment secrets aren't: once it's
-- rendered in a UI it can be shoulder-surfed, screenshotted, or pasted into a support ticket.
-- All access is via the engine's service-role connection only, exactly like `payments`.
