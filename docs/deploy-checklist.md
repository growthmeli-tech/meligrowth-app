## Estado de deploy 360/Copilot

**Resultado actual: DEPLOY BLOQUEADO (❌)**

## SEGURIDAD

- ✅ RLS habilitado para tablas nuevas: `companies`, `ml_accounts`, `users_v2`, `user_account_access`, `metric_snapshots`, `account_health`, `alerts`, `tasks`.
- ⚠️ `is_meli_growth_team()` y `can_access_ml_account()` operan, pero no fuerzan aislamiento estricto por company para roles cliente.
- ❌ Check `ops_access_enabled` en middleware activo, pero columna no existe en migraciones/tipos v2.
- ✅ Tokens ML en Storage (`meli-sessions`), no en columnas SQL.
- ❌ Cifrado de tokens no es consistente entre callback y refresh.
- ❌ `state` OAuth sin firma/nonce/TTL (hardening CSRF incompleto).
- ✅ Endpoints `/api/internal/*` validan `x-cron-secret`.

## MODELO 360/COPILOT

- ⚠️ Diferenciacion visual por plan (`360` vs `360_copilot`) implementada en UI.
- ❌ Diferenciacion de permisos por plan incompleta: `/ops/**` no habilita flujo esperado para `internal_operator_meli_growth` en Copilot.
- ⚠️ Aislamiento manager/operator depende de calidad de `user_account_access`, no de constraints duras por rol.

## DATOS Y NEGOCIO

- ✅ Pesos de scoring suman 100 en caso normal.
- ✅ Redistribucion sin Ads implementada en `lib/scoring/` (`block-calculations`, consumido por pipeline v2).
- ❌ Benchmarks de `lib/recommendations/benchmarks.ts` no coinciden plenamente con el contexto de producto.
- ❌ Flujo productivo sigue escribiendo en `diagnostics` legacy; pipeline v2 (`metric_snapshots`/`account_health`) no esta cableado end-to-end.
- ⚠️ Audiencias de alerta v2 implementadas, pero se persisten solo `urgente/alta`.

## PERFORMANCE

- ✅ `lib/data-v2/dashboard-internal.ts` evita N+1 (batch por `IN(...)`).
- ✅ Indices principales v2 cubren lecturas frecuentes de dashboard.
- ⚠️ Falta indice afinado para consulta frecuente `user_account_access` en middleware (`user_id` + `access_type`).
- ⚠️ Rate limit ML sin presupuesto global/telemetria de consumo; riesgo al escalar a 32+ cuentas.

## INTEGRACION ML

- ✅ OAuth base y refresh implementados.
- ⚠️ Fallback scraper se ejecuta cuando falla API.
- ❌ Scraper aun retorna mocks en runtime (no apto para decisiones productivas).
- ❌ Persistencia de snapshots v2 no esta activa en flujo principal.

## Checklist final con estado

- ✅ Tablas nuevas existen y tienen RLS.
- ❌ `ops_access_enabled` definido y operativo de punta a punta.
- ❌ Diferenciacion de planes aplicada en permisos y vistas operativas.
- ❌ Pipeline productivo escribiendo en `metric_snapshots`/`account_health`.
- ❌ Fallback scraper real sin mocks.
- ❌ OAuth endurecido (state firmado + cifrado consistente tokens).
- ⚠️ Rate limit gobernado con presupuesto y observabilidad.

## Decision final

- **Deploy**: ❌ NO APROBADO.
- **Bloqueantes minimos para habilitar primera cuenta real**:
  1) Migrar y estabilizar `ops_access_enabled` + regla de permisos Copilot.
  2) Activar pipeline v2 en flujo productivo (`metric_snapshots` -> `account_health` -> `alerts`).
  3) Corregir seguridad OAuth (`state` robusto + cifrado consistente tokens).
  4) Quitar mocks del scraper en runtime y medir cuota/rate limit ML.
