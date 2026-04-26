## Hallazgos de performance

## 1) Dashboard operator
- `lib/data/dashboard.ts` usa selects explicitos (sin `select('*')`) e indice esperable por filtros (`clients.active`, `diagnostics` por `client_id/date/created_at`).
- No se detecto N+1 en carga de diagnosticos del dashboard: trae clientes, diagnosticos y archivos por lote con `.in(...)`.
- **Riesgo**: El dashboard depende de varias queries separadas (clientes/diagnosticos/files/users). Con 100 cuentas puede crecer latencia total si no hay cache o paralelismo adicional en DB.

## 2) N+1 y secuencialidad en scraping dispatch
- **Hallazgo ALTO** en `lib/scraping/daily-dispatch.ts`: bucle por cliente y bucle por tipo (`salud/publicaciones/ads/stock`) con checks e inserts secuenciales.
- Impacto: patron O(clientes * tipos) con roundtrips secuenciales + ejecucion de scraper una por una.
- **Fix recomendado**:
  - Batch de existencia por cliente/dia en una sola query.
  - Cola con concurrencia limitada (ej. 3-5 clientes en paralelo).
  - Consolidacion por lotes, no inline por cliente.

## 3) ML API rate limits
- `lib/ml/client.ts` tiene retry para `429` y backoff basico (cumple minimo).
- **Gap**: no hay logging especifico/metricas de rate-limit hit, ni presupuesto por cliente/dia.
- **Proyeccion de requests (estimada)**:
  - Salud: ~1
  - Publicaciones: ~3 + hasta 40 detalle performance
  - Ads: ~2
  - Logistica: hasta ~10 (paginas ordenes)
  - Stock: hasta ~130+ (items + detalle por item + fulfillment sample)
  - **Total por cliente**: ~180 requests en escenario alto.
  - **10 clientes**: ~1.8k requests/sync.
  - **32 clientes**: ~5.7k requests/sync.
  - **100 clientes**: ~18k requests/sync.
- Con sync diario puede ser viable segun cuota, pero sin budget ni throttling central es riesgo alto de 429 en picos.

## 4) Trigger score_history
- Trigger `on_diagnostic_insert_score_history` existe en schema y pobla `score_history`.
- Cobertura funcional base correcta para graficos de evolucion.

## 5) Bundle y runtime
- `recharts` aparece en componentes client, no se detecto uso obvio en server components.
- Layouts autenticados exportan `dynamic = "force-dynamic"` en areas operator/client.

## Fixes tecnicos sugeridos (codigo)

```ts
// 1) Concurrencia controlada para dispatch diario
const MAX_CLIENT_CONCURRENCY = 4;
await pMap(clients, processClient, { concurrency: MAX_CLIENT_CONCURRENCY });
```

```ts
// 2) Presupuesto de rate-limit por cliente
if (estimatedRequests > DAILY_BUDGET_PER_CLIENT) {
  return { ok: false, error: "ml_budget_exceeded" };
}
```

```ts
// 3) Logging estructurado de 429
if (response.status === 429) {
  logRateLimit({ endpoint: path, retryAfter, clientId, sellerId });
}
```
