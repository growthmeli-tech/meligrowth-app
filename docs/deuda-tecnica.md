## Deuda: Convivencia schema legacy (`diagnostics/actions`) con v2
- **Descripcion**: El flujo operativo principal persiste en tablas legacy (`diagnostics`, `actions`) mientras el modelo 360 v2 (`metric_snapshots`, `account_health`, `alerts`, `tasks`) existe pero no gobierna el runtime principal.
- **Impacto si no se resuelve**: Doble fuente de verdad, reportes inconsistentes y bloqueo para escalar 360/Copilot.
- **Esfuerzo estimado**: 20-40 horas.
- **Prioridad**: antes del primer cliente real.
- **Plan de migracion**:
  - Fase 1: dual-write controlado (legacy + v2) al guardar diagnostico.
  - Fase 2: lectura de vistas desde v2 con fallback temporal a legacy.
  - Fase 3: backfill historico y desactivacion de writes legacy.
  - Fase 4: retiro de dependencias legacy y limpieza de tipos/queries.

## Deuda: Pipeline ML todavia no escribe `metric_snapshots` en produccion
- **Descripcion**: Existe `createMetricSnapshot` y `runRecommendationsPipelineV2`, pero no estan conectados al flujo productivo de guardado.
- **Impacto si no se resuelve**: La cadena oficial de producto no corre de punta a punta en produccion.
- **Esfuerzo estimado**: 12-24 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Namespace legacy residual (`/operator`, `/client`) aun vivo
- **Descripcion**: Persisten redirects, revalidaciones y rutas heredadas (`/operator/*`, `/client/*`) en callback OAuth y actions.
- **Impacto si no se resuelve**: Ambiguedad de navegacion, deuda de mantenimiento y riesgo de regresion en permisos.
- **Esfuerzo estimado**: 6-12 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: `ops_access_enabled` no modelado en DB v2
- **Descripcion**: El middleware depende de `user_account_access.ops_access_enabled`, pero la columna no existe en migraciones ni en `database.types`.
- **Impacto si no se resuelve**: Bloqueos de acceso a `/ops/**` y autorizacion inconsistente.
- **Esfuerzo estimado**: 4-8 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Seguridad OAuth incompleta (`state` + cifrado tokens)
- **Descripcion**: `state` no firmado y refresh de tokens sin cifrado consistente.
- **Impacto si no se resuelve**: Riesgo de secuestro de vinculacion OAuth y exposicion de credenciales.
- **Esfuerzo estimado**: 8-16 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Scraper fallback no productivo
- **Descripcion**: El scraper devuelve `mock_metrics` incluso en flujo real de extraccion.
- **Impacto si no se resuelve**: Recomendaciones con datos no confiables.
- **Esfuerzo estimado**: 16-30 horas.
- **Prioridad**: antes del primer cliente real.
