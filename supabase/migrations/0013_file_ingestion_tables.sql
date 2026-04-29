-- File ingestion: catalog, commercial scenarios, pricing SKUs, ingestion log

-- SKU-level pricing (Márgenes y Costos)
create table if not exists public.pricing_skus (
  id                 uuid primary key default gen_random_uuid(),
  ml_account_id      uuid not null references public.ml_accounts(id) on delete cascade,
  sku                text,
  producto           text not null,
  costo              numeric not null,
  peso_kg            numeric,
  logistica          text not null default 'Flex'
                     check (logistica in ('Full', 'Flex', 'Retiro domicilio')),
  reputacion         text,
  publicidad_pct     numeric,
  margen_pct         numeric,
  precio_venta       numeric,
  ganancia_unit      numeric,
  roi                numeric,
  source_file        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists idx_pricing_skus_account_sku_producto
  on public.pricing_skus (ml_account_id, lower(btrim(coalesce(sku, ''))), lower(btrim(producto)));

create index if not exists idx_pricing_skus_account on public.pricing_skus (ml_account_id, created_at desc);

-- Catalog enrichment from Ficha Técnica
create table if not exists public.catalog_enrichment (
  id            uuid primary key default gen_random_uuid(),
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  sku           text not null,
  titulo        text not null,
  descripcion   text,
  atributos     jsonb,
  source_file   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (ml_account_id, sku)
);

-- Pricing Comercial (scenario planning)
create table if not exists public.pricing_scenarios (
  id                     uuid primary key default gen_random_uuid(),
  ml_account_id         uuid not null references public.ml_accounts(id) on delete cascade,
  plan                  text not null,
  current_revenue       numeric not null,
  projected_revenue     numeric not null,
  gross_margin_pct      numeric not null,
  delivery_cost         numeric not null,
  setup_fee             numeric not null default 0,
  months                integer not null,
  net_margin_pct        numeric,
  monthly_profit        numeric,
  total_projected_profit numeric,
  source_file           text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_pricing_scenarios_account on public.pricing_scenarios (ml_account_id, created_at desc);

-- Ingestion log
create table if not exists public.file_ingestion_log (
  id                 uuid primary key default gen_random_uuid(),
  ml_account_id      uuid not null references public.ml_accounts(id) on delete cascade,
  company_id         uuid not null references public.companies(id) on delete cascade,
  template_type      text not null check (template_type in (
                       'skus_stock', 'margenes_costos',
                       'ficha_tecnica', 'pricing_comercial', 'unknown'
                     )),
  filename           text not null,
  storage_path       text,
  rows_total         integer,
  rows_valid         integer,
  rows_error         integer,
  status             text not null check (status in ('pending', 'processing', 'success', 'error')),
  error_summary      jsonb,
  metrics_updated    jsonb,
  alerts_generated   integer,
  processed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_file_ingestion_log_account
  on public.file_ingestion_log (ml_account_id, created_at desc);

-- RLS
alter table public.pricing_skus enable row level security;
create policy "internal team manages pricing skus"
  on public.pricing_skus for all
  using (public.is_meli_growth_team());
create policy "users read own pricing skus"
  on public.pricing_skus for select
  using (public.can_access_ml_account(ml_account_id));

alter table public.catalog_enrichment enable row level security;
create policy "internal team manages catalog enrichment"
  on public.catalog_enrichment for all
  using (public.is_meli_growth_team());
create policy "users read own catalog enrichment"
  on public.catalog_enrichment for select
  using (public.can_access_ml_account(ml_account_id));

alter table public.pricing_scenarios enable row level security;
create policy "internal team manages pricing scenarios"
  on public.pricing_scenarios for all
  using (public.is_meli_growth_team());
create policy "users read own pricing scenarios"
  on public.pricing_scenarios for select
  using (public.can_access_ml_account(ml_account_id));

alter table public.file_ingestion_log enable row level security;
create policy "internal team manages ingestion log"
  on public.file_ingestion_log for all
  using (public.is_meli_growth_team());
create policy "users read own ingestion log"
  on public.file_ingestion_log for select
  using (public.can_access_ml_account(ml_account_id));

-- Triggers
create trigger pricing_skus_touch_updated_at
  before update on public.pricing_skus
  for each row execute function public.touch_updated_at_v2();

create trigger catalog_enrichment_touch_updated_at
  before update on public.catalog_enrichment
  for each row execute function public.touch_updated_at_v2();
