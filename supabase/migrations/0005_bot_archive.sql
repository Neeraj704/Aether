-- Phase 10: Bot Archival Support
alter table public.bots add column if not exists archived boolean not null default false;
create index if not exists bots_user_id_archived_idx on public.bots(user_id, archived);
