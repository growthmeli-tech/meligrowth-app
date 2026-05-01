-- Data contract: default free-shipping policy when ML item has no boolean (null), for resolution order:
-- ml_api → sku_config → account_config → local_simulation → null

alter table public.ml_accounts
  add column if not exists default_free_shipping boolean;

alter table public.pricing_skus
  add column if not exists free_shipping boolean;

comment on column public.ml_accounts.default_free_shipping is
  'Fallback when ml_catalog_items.free_shipping is null; never overrides ML boolean.';

comment on column public.pricing_skus.free_shipping is
  'Per-SKU policy when ML and account default are null; never overrides ML boolean.';
