-- Client onboarding: secure ML connection invites (token stored hashed server-side).

create table if not exists public.ml_account_invites (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid not null references public.ml_accounts (id) on delete cascade,
  client_email text not null,
  client_name text not null,
  optional_account_label text,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'expired', 'revoked')),
  created_by uuid references public.users_v2 (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ml_account_invites_token_hash_unique unique (token_hash)
);

create index if not exists ml_account_invites_ml_account_id_idx
  on public.ml_account_invites (ml_account_id);

create index if not exists ml_account_invites_status_idx
  on public.ml_account_invites (status);

comment on table public.ml_account_invites is
  'Single-use hashed tokens for clients to authorize Mercado Libre OAuth for a pending ml_accounts row.';

alter table public.ml_account_invites enable row level security;

create policy "meli growth team manages ml_account_invites"
  on public.ml_account_invites for all
  using (public.is_meli_growth_team());

-- Bind OAuth CSRF state to optional invite context (server-side only).
alter table public.ml_oauth_states
  add column if not exists invite_id uuid references public.ml_account_invites (id) on delete cascade;

comment on column public.ml_oauth_states.invite_id is 'When set, OAuth completion must validate invite + session email.';
