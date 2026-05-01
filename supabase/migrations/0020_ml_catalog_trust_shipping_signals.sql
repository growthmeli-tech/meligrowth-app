-- Trust layer V2: persist ML shipping tags/methods for Flex detection + free_shipping key presence for ML contract audits.

alter table public.ml_catalog_items
  add column if not exists shipping_tags jsonb not null default '[]'::jsonb;

alter table public.ml_catalog_items
  add column if not exists shipping_methods jsonb not null default '[]'::jsonb;

alter table public.ml_catalog_items
  add column if not exists free_shipping_key_present boolean null;

comment on column public.ml_catalog_items.shipping_tags is 'ML item shipping.tags from last /items sync (JSON array of strings).';
comment on column public.ml_catalog_items.shipping_methods is 'ML item shipping.methods from last /items sync (JSON array, shape varies by site).';
comment on column public.ml_catalog_items.free_shipping_key_present is 'True if shipping.free_shipping existed on ML payload; false if absent (integration bug); null = row not yet synced with this field.';
