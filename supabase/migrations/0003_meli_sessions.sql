create type meli_session_status as enum ('missing', 'uploaded', 'validated', 'error');

create table public.meli_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  seller_id text,
  storage_path text not null,
  status meli_session_status not null default 'uploaded',
  source text not null default 'upload',
  last_validated_at timestamptz,
  last_error text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meli_sessions_client_created_idx on public.meli_sessions (client_id, created_at desc);

create function public.touch_meli_session_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meli_sessions_touch_updated_at
before update on public.meli_sessions
for each row execute function public.touch_meli_session_updated_at();

alter table public.meli_sessions enable row level security;

create policy "users read meli sessions by access"
on public.meli_sessions
for select
using (public.can_access_client(client_id));

create policy "operators create meli sessions for own clients"
on public.meli_sessions
for insert
with check (public.current_user_role() = 'operator' and public.can_access_client(client_id));

create policy "operators update meli sessions for own clients"
on public.meli_sessions
for update
using (public.current_user_role() = 'operator' and public.can_access_client(client_id))
with check (public.can_access_client(client_id));

create policy "operators delete meli sessions for own clients"
on public.meli_sessions
for delete
using (public.current_user_role() = 'operator' and public.can_access_client(client_id));
