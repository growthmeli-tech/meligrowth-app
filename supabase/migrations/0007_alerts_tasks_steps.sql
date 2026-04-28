-- ============================================================
-- Migración 0007: Steps generados por IA en alerts y tasks
-- Agrega campo steps (jsonb) para persistir los pasos
-- del checklist generados por Claude con datos reales.
-- ============================================================

alter table public.alerts
  add column if not exists steps jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists steps jsonb not null default '[]'::jsonb;

comment on column public.alerts.steps is
  'Pasos accionables generados por Claude AI usando datos reales del metric_snapshot.';

comment on column public.tasks.steps is
  'Pasos del checklist. Copiados desde alerts.steps al crear la tarea. Fallback al motor local si está vacío.';
