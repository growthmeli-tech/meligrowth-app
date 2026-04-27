## OAuth flow

- **Estado**: PARCIAL
- **Evidencia**: `app/api/ml/auth/callback/route.ts`, `lib/ml/auth.ts`
- **Lo correcto**:
  - Flujo authorize -> callback -> exchange implementado.
  - Refresh con margen de 5 minutos implementado.
  - Tokens guardados en Storage (`meli-sessions`) y no en columnas SQL.
- **Lo pendiente**:
  - `state` no firmado (usa `client_id` directo), sin nonce/TTL/atado a sesion.
  - El callback no verifica errores de `upsert/update` criticos antes de redirigir exito.
  - Inconsistencia de cifrado en refresh (callback puede cifrar, refresh guarda JSON plano).

## Pipeline: escritura en `metric_snapshots`

- **Estado**: NO CUMPLE end-to-end en runtime productivo
- **Evidencia**: `app/(internal)/internal/clients/[id]/diagnostic/new/actions.ts`, `lib/diagnostics/persist-diagnostic.ts`, `lib/data-v2/metric-snapshots.ts`, `lib/recommendations/pipeline-v2.ts`
- **Resultado**:
  - Existe infraestructura v2 para snapshots/health/alerts (`createMetricSnapshot`, `runRecommendationsPipelineV2`).
  - El flujo operativo actual sigue persistiendo diagnosticos en `diagnostics` legacy.
  - No se encontro cableado de produccion que cree `metric_snapshots` y dispare pipeline v2 al guardar diagnostico.

## Fallback scraper cuando falla API

- **Estado**: PARCIAL (funciona tecnicamente, no confiable para produccion)
- **Evidencia**: `lib/ml/pipeline.ts`, `services/scraper/scrapers/mercadolibre.py`
- **Resultado**:
  - El pipeline intenta scraper por bloque cuando la API falla.
  - Para logistica, el fallback invoca `readScraper("stock")` (desalineacion semantica).
  - El scraper retorna fixtures `mock_metrics` incluso fuera de `SCRAPER_MOCK_MODE`, por lo que el fallback no representa extraccion real todavia.

## Veredicto ML

- Integracion ML usable para pruebas, pero no lista para operar cuentas reales.
- Bloqueantes ML actuales: hardening OAuth (`state`), cifrado consistente de tokens, y scraper real sin mocks.
