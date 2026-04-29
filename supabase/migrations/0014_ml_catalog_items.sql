-- Live ML catalog: synced from ML API, joined with pricing_skus for unified operator view

create table if not exists public.ml_catalog_items (
  id                  uuid primary key default gen_random_uuid(),
  ml_account_id       uuid not null references public.ml_accounts(id) on delete cascade,
  item_id             text not null,
  title               text not null,
  price               numeric,
  available_quantity  integer,
  sold_quantity       integer,
  status              text,
  seller_custom_field text,
  condition           text,
  permalink           text,
  thumbnail           text,
  logistic_type       text,
  pricing_sku_id      uuid references public.pricing_skus(id) on delete set null,
  last_synced_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique(ml_account_id, item_id)
);

create index if not exists idx_ml_catalog_account
  on public.ml_catalog_items (ml_account_id, status, available_quantity);

create index if not exists idx_ml_catalog_pricing_sku
  on public.ml_catalog_items (pricing_sku_id)
  where pricing_sku_id is not null;

alter table public.ml_catalog_items enable row level security;

create policy "internal team manages catalog items"
  on public.ml_catalog_items for all
  using (public.is_meli_growth_team())
  with check (public.is_meli_growth_team());

create policy "users read own catalog items"
  on public.ml_catalog_items for select
  using (public.can_access_ml_account(ml_account_id));

create policy "operators manage catalog items"
  on public.ml_catalog_items for all
  using (public.can_access_ml_account(ml_account_id))
  with check (public.can_access_ml_account(ml_account_id));

-- Operators need to upsert pricing rows from OPS (cost configuration); internal team already has FOR ALL on pricing_skus
create policy "operators insert pricing skus"
  on public.pricing_skus for insert
  with check (public.can_access_ml_account(ml_account_id));

create policy "operators update pricing skus"
  on public.pricing_skus for update
  using (public.can_access_ml_account(ml_account_id))
  with check (public.can_access_ml_account(ml_account_id));
