-- Persist ML item fields required for official pricing / publication trace (API mirror).

alter table public.ml_catalog_items
  add column if not exists listing_type_id text;

alter table public.ml_catalog_items
  add column if not exists category_id text;

alter table public.ml_catalog_items
  add column if not exists catalog_product_id text;

alter table public.ml_catalog_items
  add column if not exists shipping_dimensions text;

alter table public.ml_catalog_items
  add column if not exists local_pick_up boolean;

alter table public.ml_catalog_items
  add column if not exists store_pick_up boolean;

comment on column public.ml_catalog_items.listing_type_id is 'ML item.listing_type_id from last /items sync.';
comment on column public.ml_catalog_items.category_id is 'ML item.category_id from last /items sync.';
comment on column public.ml_catalog_items.catalog_product_id is 'ML item.catalog_product_id when user listing is catalog-backed.';
comment on column public.ml_catalog_items.shipping_dimensions is 'Raw ML shipping.dimensions string.';
comment on column public.ml_catalog_items.local_pick_up is 'ML shipping.local_pick_up.';
comment on column public.ml_catalog_items.store_pick_up is 'ML shipping.store_pick_up.';
