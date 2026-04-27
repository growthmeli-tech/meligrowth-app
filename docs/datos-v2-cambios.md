# Datos V2 — Cambios implementados

- `lib/supabase/database.types.ts`: se regeneraron tipos para incluir tablas del schema 0004 (`companies`, `ml_accounts`, `users_v2`, `user_account_access`, `metric_snapshots`, `account_health`, `alerts`, `tasks`, `task_events`, `ingestion_runs`) y enums `user_role_v2`/`plan_type`; esto habilita tipado fuerte sobre el modelo nuevo.
- `lib/types/enums.ts`: se agregaron enums del modelo v2 y checks de tablas nuevas (`PlanType`, `UserAccountAccessType`, `MetricSnapshotSource`, `AlertPriority`, `AlertAudience`, `TaskPriority`, `TaskStatus`, `IngestionRunSource`, `IngestionRunStatus`) manteniendo compat con enums legacy.
- `lib/data-v2/companies.ts`: nuevas queries tipadas para listar y obtener companies del nuevo modelo.
- `lib/data-v2/ml-accounts.ts`: nuevas queries tipadas para cuentas ML por company, lookup por id y carga batch de cuentas activas.
- `lib/data-v2/metric-snapshots.ts`: nuevas queries tipadas para historial, último snapshot y creación de `metric_snapshots`.
- `lib/data-v2/account-health.ts`: nuevas queries tipadas para `account_health`, último estado, y delta temporal (`getDiagnosticWithDelta`) en el nuevo modelo.
- `lib/data-v2/alerts.ts`: nuevas queries tipadas para alertas por `ml_account_id`, con filtros por `audiencia` y carga batch de urgentes pendientes.
- `lib/data-v2/tasks.ts`: nuevas queries tipadas para tareas por cuenta, pendientes batch y trazabilidad vía `task_events`.
- `lib/data-v2/ingestion-runs.ts`: nuevas queries tipadas para historial y último `ingestion_run` por cuenta.
- `lib/data-v2/dashboard-internal.ts`: se creó query agregada para dashboard interno sin N+1; trae companies activas + cuenta ML activa + último `account_health` + conteo de alertas urgentes pendientes + conteo de tareas pendientes.
- `lib/data-v2/index.ts`: re-export centralizado de toda la capa `data-v2` para consumo modular.
- `lib/config/constants.ts`: se agregaron constantes de negocio del nuevo modelo `PLAN_TYPE_VALUES` y `USER_ACCOUNT_ACCESS_TYPES`.
