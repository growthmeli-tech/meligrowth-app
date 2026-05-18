alter table public.user_account_access
  add column if not exists ops_access_enabled boolean not null default false;
