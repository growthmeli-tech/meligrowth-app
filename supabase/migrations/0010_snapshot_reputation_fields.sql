-- 0010: Reputation enrichment fields for ML seller intelligence
alter table public.metric_snapshots
  add column if not exists nivel_vendedor text,
  add column if not exists ventas_completadas_60d numeric,
  add column if not exists periodo_reputacion text;

comment on column public.metric_snapshots.nivel_vendedor is
  'power_seller_status from ML seller_reputation: null, silver, gold, platinum';
comment on column public.metric_snapshots.ventas_completadas_60d is
  'metrics.sales.completed from seller_reputation (60 or 365 day period)';
comment on column public.metric_snapshots.periodo_reputacion is
  'metrics.sales.period from seller_reputation: "60 days" or "365 days"';
