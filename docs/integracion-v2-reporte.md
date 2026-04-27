# Integracion V2 — Reporte de bloqueantes go-live

## Bloqueante 1 — `ops_access_enabled` en tipos/schema
- **Estado**: RESUELTO
- **Cambios aplicados**:
  - `lib/supabase/database.types.ts`: `user_account_access.Row.ops_access_enabled: boolean`.
  - `lib/types/enums.ts`: agregado `UserAccountAccessFlags`.
  - `middleware.ts`: validacion de `/ops/**` basada en `ops_access_enabled=true`.
  - `lib/data-v2/ml-accounts.ts`: queries de `user_account_access` incluyen `ops_access_enabled`.

## Bloqueante 2 — Pipeline escribiendo en schema legacy
- **Estado**: PARCIAL
- **Cambios aplicados**:
  - `lib/ml/pipeline.ts`: dual-write v2 opcional (crea `metric_snapshots` y dispara `runRecommendationsPipelineV2`) cuando hay `mlAccountId`.
  - `app/api/ml/sync/route.ts`: actualizado para usar el flujo v2 cuando llega `ml_account_id`, manteniendo fallback legacy por `client_id`.
- **Pendiente**:
  - Completar adopcion v2 en todos los entrypoints operativos para que el write principal no dependa de fallback.

## Bloqueante 3 — OAuth cifrado inconsistente
- **Estado**: RESUELTO
- **Cambios aplicados**:
  - `lib/ml/auth.ts`: `saveSessionTokens` centraliza formato canonico y cifrado.
  - Formato unificado en Storage: `{ access_token, refresh_token, expires_at }`.
  - `app/api/ml/auth/callback/route.ts`: usa `saveSessionTokens` (misma ruta que refresh).
  - `lib/ml/mappers/types.ts`: `MlStoredTokens` alineado al formato canonico.

## Bloqueante 4 — Scraper con mocks en runtime
- **Estado**: PARCIAL
- **Cambios aplicados**:
  - `.env.example`: `SCRAPER_MOCK_MODE=false`.
  - `docs/ml-setup.md`: marcado como paso obligatorio previo a go-live.
- **Pendiente externo**:
  - El scraper sigue con implementacion placeholder para extraccion real; requiere reemplazar `mock_metrics` por selectores productivos para cerrar el riesgo completamente.

## Validacion por bloqueante
- Bloqueante 1: `npm run test` (84 passed, 0 failed) + `npm run build` OK.
- Bloqueante 2: `npm run test` (84 passed, 0 failed) + `npm run build` OK.
- Bloqueante 3: `npm run test` (84 passed, 0 failed) + `npm run build` OK.
- Bloqueante 4: `npm run test` (84 passed, 0 failed) + `npm run build` OK.
