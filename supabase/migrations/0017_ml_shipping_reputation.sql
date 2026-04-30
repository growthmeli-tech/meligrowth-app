-- ML account seller reputation (API sync) + catalog shipping fields for AR shipping estimate

alter table public.ml_accounts
  add column if not exists seller_reputation_level text,
  add column if not exists seller_power_seller_status text,
  add column if not exists seller_reputation_synced_at timestamptz;

alter table public.ml_catalog_items
  add column if not exists free_shipping boolean,
  add column if not exists shipping_mode text,
  add column if not exists package_weight_kg numeric;
