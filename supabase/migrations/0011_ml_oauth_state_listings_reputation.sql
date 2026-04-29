-- OAuth CSRF: random state bound to ml_account (short-lived).
create table if not exists public.ml_oauth_states (
  state text primary key,
  ml_account_id uuid not null references public.ml_accounts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ml_oauth_states_expires_at_idx on public.ml_oauth_states (expires_at);

comment on table public.ml_oauth_states is 'Short-lived OAuth state tokens for ML authorization (CSRF). Insert/delete via service role only.';

alter table public.ml_oauth_states enable row level security;

-- Listings capacity risk signal + reputation protection flags (ML GET /users).
alter table public.metric_snapshots
  add column if not exists listings_quota numeric,
  add column if not exists listings_total_items numeric,
  add column if not exists reputacion_protegida boolean,
  add column if not exists reputacion_real_level text,
  add column if not exists reputacion_level_id text;
