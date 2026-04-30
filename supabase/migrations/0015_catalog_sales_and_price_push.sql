-- Sales aggregates (30d) + ML price push audit on catalog items

alter table public.ml_catalog_items
  add column if not exists ventas_30d integer,
  add column if not exists revenue_30d numeric,
  add column if not exists last_sale_date timestamptz,
  add column if not exists last_price_push_at timestamptz,
  add column if not exists last_price_push_value numeric,
  add column if not exists last_price_push_status text
    check (last_price_push_status in ('pending', 'success', 'error')
           or last_price_push_status is null);
