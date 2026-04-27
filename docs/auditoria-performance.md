## 1) Dashboard interno con 32 cuentas (foco N+1)

- **Estado**: CUMPLE (sin N+1 evidente)
- **Evidencia**: `lib/data-v2/dashboard-internal.ts`
- **Resultado**:
  - 1 query para companies activas.
  - 1 query para cuentas activas por company.
  - 3 queries batch (`account_health`, `alerts`, `tasks`) por `IN(accountIds)`.
  - No hay loops con queries por cuenta; los loops solo agregan resultados en memoria.

## 2) Indices v2 vs queries frecuentes

- **Estado**: PARCIAL
- **Evidencia**: `supabase/migrations/0004_new_model_360.sql`, `lib/data-v2/*`, `middleware.ts`
- **Alineados**:
  - `idx_snapshots_account_date` para historial y latest snapshot.
  - `idx_health_account_date` para latest health por cuenta.
  - `idx_alerts_account_prioridad` para urgentes pendientes.
  - `idx_tasks_account_estado` para pendientes/en_curso.
- **Gap**:
  - Falta indice explicito sobre `user_account_access(user_id, access_type)` para chequeo frecuente de middleware en `/ops/**`.

## 3) Rate limit ML con cartera objetivo

- **Estado**: RIESGO ALTO
- **Evidencia**: `lib/ml/endpoints/*.ts`, `lib/ml/client.ts`, `lib/scraping/daily-dispatch.ts`
- **Proyeccion aproximada por cuenta/sync**:
  - Salud: ~1 request.
  - Publicaciones: ~4 + hasta 40 `item/performance`.
  - Ads: ~2.
  - Logistica: hasta 10 (`/orders/search` paginado + 2 listados).
  - Stock: hasta 135 (3 paginas items + hasta 120 detalles + hasta 3 fulfillment).
  - **Total pico por cuenta**: ~190-200 requests.
- **Escenarios**:
  - 32 cuentas: ~6.0k-6.4k requests por corrida.
  - 100 cuentas: ~19k-20k requests por corrida.
- **Problema**:
  - Hay retry de `429` en `mlFetch`, pero no hay budget global, cola por cuota ni metricas de consumo diario.

## 4) Cuellos adicionales detectados

- `runDailyScrapingDispatch` ejecuta ciclos secuenciales cliente x tipo de job y consolida inline, lo que eleva latencia total al escalar.
- No existe control central de concurrencia por cuenta para llamadas ML y scraping en lote.

## Recomendaciones prioritarias

1. Agregar presupuesto diario por cuenta y global de requests ML con corte preventivo.
2. Instrumentar logs/metricas de `429` y `Retry-After` por endpoint.
3. Ejecutar dispatch con concurrencia acotada (pool) en vez de flujo totalmente secuencial.
4. Crear indice para filtro de acceso operativo (`user_id` + `access_type`) si se mantiene esa consulta en middleware.
