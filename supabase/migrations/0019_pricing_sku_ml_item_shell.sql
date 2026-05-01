-- Shell pricing rows per ML publication: nullable costo, stable ml_item_id for 1:1 linking.

alter table public.pricing_skus
  alter column costo drop not null;

alter table public.pricing_skus
  add column if not exists ml_item_id text;

comment on column public.pricing_skus.ml_item_id is
  'Mercado Libre item_id when this row is the 1:1 pricing shell for that publication; unique per ml_account_id.';

create unique index if not exists idx_pricing_skus_account_ml_item
  on public.pricing_skus (ml_account_id, ml_item_id)
  where ml_item_id is not null and btrim(ml_item_id) <> '';

-- Backfill ml_item_id from existing catalog links (idempotent).
update public.pricing_skus ps
set ml_item_id = m.item_id
from public.ml_catalog_items m
where m.pricing_sku_id = ps.id
  and ps.ml_item_id is null
  and m.item_id is not null
  and btrim(m.item_id) <> '';
