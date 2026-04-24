create type pricing_proposal_source as enum ('manual', 'template');

create table public.pricing_proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  source pricing_proposal_source not null default 'manual',
  plan client_plan not null,
  current_revenue numeric not null default 0,
  projected_revenue numeric not null default 0,
  gross_margin_pct numeric not null default 0,
  delivery_cost numeric not null default 0,
  setup_fee numeric not null default 0,
  months integer not null default 1,
  fixed_fee numeric not null default 0,
  variable_commission numeric not null default 0,
  monthly_fee numeric not null default 0,
  operator_profit numeric not null default 0,
  operator_margin_pct numeric not null default 0,
  total_contract_value numeric not null default 0,
  payback_ratio numeric not null default 0,
  recommended boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.pricing_proposals enable row level security;

create policy "users read pricing proposals by access"
on public.pricing_proposals
for select
using (public.can_access_client(client_id));

create policy "operators create pricing proposals for own clients"
on public.pricing_proposals
for insert
with check (public.current_user_role() = 'operator' and public.can_access_client(client_id));

create policy "operators update pricing proposals for own clients"
on public.pricing_proposals
for update
using (public.current_user_role() = 'operator' and public.can_access_client(client_id))
with check (public.can_access_client(client_id));

create policy "operators delete pricing proposals for own clients"
on public.pricing_proposals
for delete
using (public.current_user_role() = 'operator' and public.can_access_client(client_id));
