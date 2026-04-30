-- Account-level fiscal configuration for net margin (Financial Engine V2)

create table if not exists public.ml_account_financial_settings (
  id uuid primary key default gen_random_uuid(),

  ml_account_id uuid not null
    references public.ml_accounts(id)
    on delete cascade,

  iibb_pct numeric,
  tax_pct numeric,
  internal_logistics_cost numeric,
  additional_costs_pct numeric,
  additional_costs_fixed numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (ml_account_id)
);

create index if not exists idx_ml_account_financial_settings_account
  on public.ml_account_financial_settings (ml_account_id);

alter table public.ml_account_financial_settings enable row level security;

create policy "internal team manages ml account financial settings"
  on public.ml_account_financial_settings for all
  using (public.is_meli_growth_team())
  with check (public.is_meli_growth_team());

create policy "users read accessible ml account financial settings"
  on public.ml_account_financial_settings for select
  using (public.can_access_ml_account(ml_account_id));

create policy "operators insert ml account financial settings"
  on public.ml_account_financial_settings for insert
  with check (public.can_access_ml_account(ml_account_id));

create policy "operators update ml account financial settings"
  on public.ml_account_financial_settings for update
  using (public.can_access_ml_account(ml_account_id))
  with check (public.can_access_ml_account(ml_account_id));

create trigger ml_account_financial_settings_touch_updated_at
  before update on public.ml_account_financial_settings
  for each row execute function public.touch_updated_at_v2();
