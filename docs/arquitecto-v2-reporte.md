# Reporte Arquitecto V2

## Sección 1 — Resumen ejecutivo
- La migración `0004_new_model_360.sql` define correctamente el modelo 360/360 Copilot (3 vistas, 4 roles, entidades nuevas y RLS), pero la app productiva sigue operando casi por completo sobre el schema legacy (`clients`, `diagnostics`, `actions`, `notifications`).
- La vista `internal` existe y tiene mayor madurez funcional, pero su lógica y datos están alineados al modelo viejo (`operator/client`, planes `starter/growth/scale`) y no al modelo `company/ml_account` con `plan_type`.
- Las vistas nuevas `brand` y `ops` existen solo como placeholder (`dashboard` estático) y no consumen `account_health`, `alerts` ni `tasks` del nuevo schema.
- La cadena objetivo `API ML → metric_snapshots → account_health → alerts → tasks → UI` no está implementada end-to-end: hay ingestas y scraping, pero consolidan en `diagnostics` legacy y no en tablas v2.
- Para habilitar el primer cliente real bajo el modelo 360°/Copilot, el principal bloqueo es la migración funcional de acceso a datos y vistas al schema nuevo, no la infraestructura base de Supabase.

## Sección 2 — Estado de las 3 vistas
| Vista | Ruta | Existe | Conectada a nuevo schema | Gaps críticos |
|---|---|---|---|---|
| Internal | `/internal/**` | Sí (`app/(internal)/internal/dashboard/page.tsx`, `app/(internal)/internal/clients/[id]/page.tsx`) | No | Consume `clients/diagnostics/actions` legacy vía `lib/data/dashboard.ts` y `lib/data/clients.ts`; navegación y server actions siguen en namespace `/operator/**` (`components/layout/app-shell.tsx`, múltiples imports a `app/(operator)/...`). |
| Brand | `/brand/**` | Parcial (`app/(brand)/brand/dashboard/page.tsx`) | No | Solo placeholder estático; no existen `/brand/metrics` ni `/brand/notifications`; no consume `account_health` ni alertas estratégicas. |
| Ops | `/ops/**` | Parcial (`app/(ops)/ops/dashboard/page.tsx`) | No | Solo placeholder estático; no existen `/ops/alerts`, `/ops/tasks`, `/ops/listings`, `/ops/stock`, `/ops/ads`; no usa `alerts/tasks` v2 ni prioridades del día. |

## Sección 3 — Estado de la cadena de datos
- ✅ **API ML (extracción):** existe integración OAuth y fetch de métricas (`app/api/ml/auth/callback/route.ts`, `lib/ml/pipeline.ts`, `lib/ml/endpoints/*`), con fallback scraper por bloque.
- ❌ **`metric_snapshots` (normalización):** no hay escrituras a `metric_snapshots`; el código app no usa esa tabla (`rg` en código solo muestra uso de `users_v2`).
- ❌ **`account_health` (scoring persistido):** no hay persistencia en `account_health`; el scoring se guarda en `diagnostics` legacy (`lib/diagnostics/persist-diagnostic.ts`).
- ❌ **`alerts` (nuevo modelo):** el motor de recomendaciones devuelve estructuras en memoria (`lib/recommendations/engine.ts`), pero no inserta en tabla `alerts` v2; las notificaciones activas usan `notifications` legacy (`lib/data/notifications.ts`).
- ❌ **`tasks` (nuevo modelo):** la operación diaria usa `actions` legacy (`app/(internal)/internal/clients/[id]/actions.ts`, `lib/data/clients.ts`), no `tasks`.
- ⚠️ **UI final por rol:** middleware ya enruta por roles v2 (`middleware.ts`), pero las vistas consumen datos legacy y no la salida de la cadena objetivo.

## Sección 4 — Estado del motor de recomendaciones en el nuevo modelo
- El motor existe y genera recomendaciones (`lib/recommendations/engine.ts`), pero su input es `diagnostics` (schema viejo), no `metric_snapshots/account_health`.
- El campo de audiencia en el motor usa `operator | client | both` (`lib/recommendations/types.ts`), mientras la migración 0004 y RLS de `alerts` esperan `internal | manager | operator | all` (`supabase/migrations/0004_new_model_360.sql`).
- No hay separación efectiva por rol nuevo en persistencia porque no se escriben `alerts` v2; hoy la segmentación real en producto se hace vía `notifications` legacy por `user_id`.
- La vista manager (`/brand`) no consume recomendaciones estratégicas; la vista operator (`/ops`) tampoco consume recomendaciones operativas reales.
- Conclusión: motor técnicamente útil, pero no acoplado al contrato de datos y audiencias del modelo 360 v2.

## Sección 5 — Gaps críticos ordenados por impacto
- **[BLOQUEANTE]** Vista afectada: internal/brand/ops  
  Descripción: La aplicación de negocio sigue acoplada al schema viejo (`clients/diagnostics/actions`) y no usa las tablas de 0004.  
  Impacto: No hay operación real sobre el modelo 360 (company/ml_account, audiencias y permisos por cuenta).  
  Archivo: `lib/data/clients.ts`, `lib/data/dashboard.ts`, `lib/diagnostics/persist-diagnostic.ts`, `lib/supabase/database.types.ts`.

- **[BLOQUEANTE]** Vista afectada: brand/ops  
  Descripción: Las vistas nuevas están incompletas (solo dashboards estáticos).  
  Impacto: No se cubren los casos de uso clave para `client_manager` y `client_operator` del primer cliente real.  
  Archivo: `app/(brand)/brand/dashboard/page.tsx`, `app/(ops)/ops/dashboard/page.tsx`, ausencia de rutas en `app/(brand)/brand/*` y `app/(ops)/ops/*`.

- **[CRÍTICO]** Vista afectada: internal  
  Descripción: Namespace y dependencias de rutas inconsistentes (`/internal` en filesystem, `/operator` en links/imports).  
  Impacto: Alto riesgo de navegación rota y deuda estructural; dificulta estabilizar permisos y mantenibilidad.  
  Archivo: `components/layout/app-shell.tsx`, `app/(internal)/internal/*` (imports a `@/app/(operator)/operator/...`).

- **[CRÍTICO]** Vista afectada: ops  
  Descripción: Regla de acceso Copilot no implementada: `internal_operator_meli_growth` no puede entrar a `/ops/**` por middleware.  
  Impacto: Incumple comportamiento esperado del plan Copilot para operación diaria.  
  Archivo: `middleware.ts`.

- **[CRÍTICO]** Vista afectada: internal/brand/ops  
  Descripción: Modelo de plan no migrado (`starter/growth/scale` vs `360/360_copilot`).  
  Impacto: No se puede diferenciar correctamente operación 360 vs Copilot en filtros, permisos y experiencia.  
  Archivo: `app/(internal)/internal/dashboard/page.tsx`, `app/(internal)/internal/clients/new/actions.ts`, `lib/types/domain.ts`.

- **[IMPORTANTE]** Vista afectada: internal/ops  
  Descripción: Cadena de ingestión/scraping consolida en `diagnostics` y no en `metric_snapshots/account_health/ingestion_runs`.  
  Impacto: Sin trazabilidad v2 por eslabón, sin recalculo desacoplado y sin observabilidad de fuentes en modelo nuevo.  
  Archivo: `lib/scraping/daily-dispatch.ts`, `lib/diagnostics/consolidate-scraping.ts`, `lib/diagnostics/persist-diagnostic.ts`.

- **[IMPORTANTE]** Vista afectada: brand/ops  
  Descripción: Contrato de audiencia de recomendaciones no compatible con `alerts` v2 (`client/both` vs `manager/all`).  
  Impacto: Aunque se migre persistencia, alertas quedarían mal segmentadas por rol.  
  Archivo: `lib/recommendations/types.ts`, `lib/recommendations/engine.ts`, `supabase/migrations/0004_new_model_360.sql`.

- **[MENOR]** Vista afectada: internal  
  Descripción: Persisten documentos/tests referenciando rutas legacy `(operator)` que ya no existen físicamente.  
  Impacto: Ruido operativo y riesgo de regresiones en futuras iteraciones.  
  Archivo: `tests/integration/*`, `docs/arquitecto-reporte.md`, `docs/ui-cambios.md`.

## Sección 6 — Compatibilidad schema viejo vs nuevo
- **Usan schema viejo (activo):** `lib/data/*`, `lib/diagnostics/*`, `lib/files/*`, `lib/ml/*` (cuando persiste), server actions en `app/(internal)` y `app/(client)`, servicios Python (`services/scraper/main.py`) y edge functions (`supabase/functions/process-file/index.ts`) operan sobre `clients`, `diagnostics`, `actions`, `notifications`, `scraping_jobs`, `meli_sessions`.
- **Usan schema nuevo (parcial):** autenticación/enrutamiento por rol v2 en `middleware.ts`, `app/page.tsx`, `app/(auth)/login/actions.ts` (lectura de `users_v2`).
- **Definición nueva presente pero no consumida por app:** `companies`, `ml_accounts`, `user_account_access`, `metric_snapshots`, `account_health`, `alerts`, `tasks`, `task_events`, `ingestion_runs` (`supabase/migrations/0004_new_model_360.sql`).
- **`lib/supabase/database.types.ts`** sigue tipando solo schema legacy; esto bloquea adopción segura de tablas 0004 en código TypeScript.
- **Conclusión de compatibilidad:** hoy la convivencia es asimétrica: nuevo schema existe en DB/migración, pero el runtime funcional sigue en legacy.

## Sección 7 — Roadmap para los otros agentes
| Agente | Tarea | Por qué importa | Dependencias |
|---|---|---|---|
| Agente Datos | Regenerar `lib/supabase/database.types.ts` y crear capa `lib/data-v2/` sobre tablas 0004 | Sin tipos y repositorios v2 no hay migración segura de vistas ni pipeline | 0004 aplicada y validada en entorno activo |
| Agente Integrador | Migrar flujo de persistencia: `metric_snapshots` + `account_health` + `alerts` + `tasks` (dejar `diagnostics/actions` en compat temporal) | Habilita cadena end-to-end del producto definido | Capa `data-v2` y contrato de scoring/recomendaciones |
| Agente Recomendaciones | Ajustar audiencias y salida del motor al contrato v2 (`internal/manager/operator/all`) y persistencia en `alerts` | Permite segmentación correcta por rol y vistas brand/ops | Integrador completó escritura en `alerts` |
| Agente UI | Completar `/brand/metrics`, `/brand/notifications`, `/ops/alerts`, `/ops/tasks`, `/ops/listings`, `/ops/stock`, `/ops/ads` consumiendo v2 | Cierra valor visible para manager/operator en primer cliente real | Datos v2 y recomendaciones persistidas |
| Agente Seguridad | Alinear middleware + RLS con reglas Copilot/360 (acceso `/ops` para MG en Copilot según `user_account_access`) | Evita errores de autorización y bloqueos de operación | Datos v2 + definición final de regla de acceso Copilot |
| Agente Testing | Suite E2E de cadena completa por rol y por plan (360 y Copilot) | Reduce riesgo de go live con regresiones en permisos o pipeline | Integrador, UI y Seguridad completados |

## Sección 8 — Checklist Go Live primer cliente
- [ ] `users_v2`, `companies`, `ml_accounts` y `user_account_access` poblados para al menos una company real.
- [ ] Middleware y RLS validados para los 4 roles nuevos en rutas `/internal`, `/brand`, `/ops`.
- [ ] Ingesta diaria escribe en `metric_snapshots` con `data_sources` y `ingestion_runs`.
- [ ] Scoring persiste en `account_health` sin recálculo en frontend.
- [ ] Motor genera y persiste `alerts` con audiencia correcta (`manager` vs `operator` vs `internal`).
- [ ] Flujo operativo persiste `tasks` y `task_events` con estados y responsables.
- [ ] `/brand/**` y `/ops/**` completadas con datos reales (no placeholders).
- [ ] Diferenciación de plan (`360` vs `360_copilot`) visible en permisos y operación diaria.
- [ ] OAuth ML y storage de tokens cifrados validados en cuenta real.
- [ ] Monitoreo mínimo activo (health endpoint + alertas de corrida fallida + trazabilidad de ingestion).

## Sección 9 — Preguntas abiertas
- ¿En plan Copilot, `internal_operator_meli_growth` debe operar exclusivamente en `/internal/**` o también en `/ops/**` con UX de operador?
- ¿Se mantiene una tabla puente temporal de compatibilidad (`diagnostics/actions`) durante migración, o se corta de forma directa al modelo 0004?
- ¿El `client_manager` debe ver agregación por `company` (múltiples `ml_accounts`) en `/brand/dashboard` desde el primer release?
- ¿Cuál es la regla final para asignación de `client_operator` cuando una company tiene múltiples cuentas (`1 operador por cuenta` vs `pool`)?
- ¿Se requiere backfill histórico desde `diagnostics` legacy hacia `metric_snapshots/account_health` para no perder evolución al migrar?
