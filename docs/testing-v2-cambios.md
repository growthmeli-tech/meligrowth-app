# Testing V2 — Cambios implementados

## Alcance
- Se extendio la suite para cubrir modelo 360 y 360 Copilot sin editar tests existentes.
- Se agregaron factories v2 para `companies`, `ml_accounts`, `users_v2`, `user_account_access`, `metric_snapshots`, `account_health` y `alerts`.
- Se sumaron tests unitarios nuevos para `lib/recommendations/persist.ts` y `lib/recommendations/pipeline-v2.ts`.
- Se incorporo una suite de autorizacion por rol/plan para `middleware.ts`.
- Se agrego test de dashboard interno para verificar diferenciacion de planes `360` vs `360_copilot`.

## Archivos modificados y creados
- `tests/helpers/factories.ts`
  - Nuevos factories:
    - `createMockCompany(overrides?)`
    - `createMockMLAccount(overrides?)`
    - `createMockUserV2(role, overrides?)`
    - `createMockUserAccountAccess(overrides?)` (incluye `ops_access_enabled`)
    - `createMockMetricSnapshot(overrides?)` (incluye `data_sources`)
    - `createMockAccountHealth(overrides?)` (incluye scores por bloque)
    - `createMockAlert(audiencia, overrides?)`
- `tests/unit/lib/recommendations/persist.test.ts`
  - Cobertura de persistencia solo para prioridades `urgente` y `alta`
  - Validacion de vinculo `health_id`
  - Validacion de `persisted_count`
  - Manejo de error de Supabase sin throw
- `tests/unit/lib/recommendations/pipeline-v2.test.ts`
  - Contrato de salida `{ account_health, recommendations, persisted_alerts_count }`
  - Invariante de `score_global` en rango `[0, 100]`
  - Caso Ads sin datos con expectativa de redistribucion de pesos
  - Audiencias esperadas en recomendaciones (`internal`, `manager`, `operator`, `all`)
- `tests/unit/middleware/authorization-v2.test.ts`
  - Matriz de acceso por rol para `/internal/`, `/brand/`, `/ops/`
  - Casos de Copilot con `ops_access_enabled` verdadero/falso
  - Diferenciacion de acceso operativo por plan `360` vs `360_copilot`
- `tests/unit/lib/data-v2/dashboard-internal.test.ts`
  - Verificacion de que el dashboard interno puede distinguir companies por plan (`360` y `360_copilot`)

## Resultado de `npm run test`
- Estado general: **fallando** (no se modificaron tests legacy).
- Totales:
  - Test files: `5 failed | 17 passed (22)`
  - Tests: `3 failed | 70 passed (73)`

### Fallas detectadas en la corrida
- **Tests legacy con imports rotos (preexistente)**:
  - `tests/integration/actions/clients.test.ts`
  - `tests/integration/actions/diagnostics.test.ts`
  - `tests/integration/e2e-chain.test.ts`
  - Motivo: imports a rutas legacy `@/app/(operator)/...` que ya no existen.
- **Fallas de comportamiento capturadas por los tests nuevos**:
  - `tests/unit/middleware/authorization-v2.test.ts`
    - En plan `360_copilot` con `ops_access_enabled=false`, `client_operator` no es bloqueado en `/ops/`.
  - `tests/unit/lib/recommendations/pipeline-v2.test.ts`
    - Sin datos de Ads, el `score_global` no aplica redistribucion de pesos esperada.

## Fixes aplicados
- **Imports legacy corregidos**:
  - `tests/integration/actions/clients.test.ts`
  - `tests/integration/actions/diagnostics.test.ts`
  - `tests/integration/e2e-chain.test.ts`
  - Se reemplazaron imports desde `@/app/(operator)/...` por `@/app/(internal)/internal/...`.
- **Bug de middleware corregido** (`middleware.ts`):
  - Se agrego verificacion de `user_account_access` para `client_operator` con `access_type='operator'`.
  - El acceso a `/ops/**` ahora requiere `ops_access_enabled=true`.
  - Si `ops_access_enabled=false`, la redireccion va a `/brand/dashboard`.
- **Redistribucion de pesos sin Ads implementada**:
  - El módulo `lib/scoring/` (p. ej. `block-calculations.ts`) centraliza la regla de pesos dinamicos para score global.
  - Cuando `gasto_ads`, `ventas_ads` y `ventas_totales` son `null`, Ads queda con peso `0` y se redistribuyen los `20` puntos entre Salud/Publicaciones/Logistica/Stock.
  - `lib/recommendations/pipeline-v2.ts` usa esa regla al calcular `score_global`.
