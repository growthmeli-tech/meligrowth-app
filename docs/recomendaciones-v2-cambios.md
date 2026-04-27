# Cambios Recomendaciones V2

## Objetivo
Se alineo el motor de recomendaciones con el contrato del schema v2 para que pueda persistir alertas en `alerts` sin romper el flujo legacy (`diagnostics/actions`).

## Cambios implementados

### 1) Audiencias v2 en tipos y engine
- Se actualizo `RecommendationAudience` en `lib/recommendations/types.ts` a:
  - `internal`
  - `manager`
  - `operator`
  - `all`
- Se reemplazo el mapeo viejo por un resolver de audiencia en `lib/recommendations/engine.ts`:
  - Alertas estrategicas de rentabilidad (por ejemplo `roas` y `ads_profitability`) -> `manager`
  - Alertas operativas (`publicaciones`, `logistica`, `stock`, `acos`) -> `operator`
  - Alertas de salud criticas/alta prioridad -> `internal`
  - Alertas transversales de alta criticidad (por ejemplo envios a tiempo urgente) -> `all`

### 2) Persistencia de alertas de alta prioridad
- Se agrego `createAlertsBulk` en `lib/data-v2/alerts.ts` para insercion masiva.
- Se creo `lib/recommendations/persist.ts` con `persistRecommendationsAsAlerts(...)`:
  - Recibe output de `generateRecommendations()`
  - Requiere `ml_account_id` y `health_id` para vincular con `account_health`
  - Persiste solo prioridades `urgente` y `alta`
  - Deja `media` y `baja` en memoria

### 3) Pipeline completo post-ingesta para v2
- Se creo `lib/recommendations/pipeline-v2.ts` con `runRecommendationsPipelineV2(...)`.
- Flujo implementado:
  1. Carga `metric_snapshot` por `ml_account_id` + `metric_snapshot_id`
  2. Calcula scoring con `lib/scoring.ts`
  3. Persiste `account_health`
  4. Genera recomendaciones con `engine.ts`
  5. Persiste alertas urgentes/altas con `persist.ts`
  6. Retorna `{ account_health, recommendations, persisted_alerts_count }`

### 4) Exports
- Se actualizaron exports en `lib/recommendations/index.ts` para incluir:
  - `persist.ts`
  - `pipeline-v2.ts`

### 5) Tests
- Se actualizo `tests/unit/lib/recommendations/engine.test.ts` para:
  - Validar nuevo enum de audiencia v2
  - Cubrir asignaciones de audiencia `internal`, `manager` y `all`

## Notas de compatibilidad
- No se modifico el flujo legacy de `diagnostics/actions`.
- El nuevo flujo v2 corre en paralelo y escribe sobre `account_health` + `alerts`.
