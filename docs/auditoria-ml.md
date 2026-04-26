## Estado OAuth

- **Implementado**: callback OAuth en `app/api/ml/auth/callback/route.ts`, exchange/refresh en `lib/ml/auth.ts`.
- **Guardrails presentes**:
  - `state` no nulo.
  - Tokens en bucket `meli-sessions`.
  - Refresh con margen de 5 minutos (`REFRESH_MARGIN_SECONDS=300`).
- **Riesgos criticos**:
  - `state` no firmado ni vinculado a sesion de operador (riesgo CSRF/hijack de vinculacion).
  - Escritura de tokens inconsistente: callback puede cifrar, refresh guarda plano.
  - `upsert/update` en callback sin chequeo de error.

## Estado pipeline por bloque

- **Salud**: API oficial + fallback scraper (cumple estructura).
- **Publicaciones**: API oficial + calculo de optimizacion por muestra de items (cumple estructura).
- **Ads**: API oficial + mapeo ACOS/ROAS/TACOS (cumple estructura).
- **Logistica**: API oficial, pero fallback usa `readScraper("stock")` (desalineado semanticamente).
- **Stock**: API oficial parcial (deja `dias_stock` y `lead_time_reposicion` en `null` por ahora) + fallback scraper.

## Riesgos de integracion

1. **Integracion UI incompleta (ALTO)**
   - Existe `POST /api/ml/sync`, pero no hay evidencia de uso real desde formulario de diagnostico para prefill operator.
   - Resultado: pipeline existe pero no siempre impacta UX operativa.

2. **Persistencia de trazabilidad incompleta (ALTO)**
   - `prefill.data_sources` se arma en pipeline pero no se persiste en `diagnostics`.
   - Se pierde auditoria de origen (api/scraper/manual) por campo.

3. **Scraper fallback no listo para produccion (CRITICO)**
   - `services/scraper/scrapers/mercadolibre.py` devuelve `mock_metrics` aun fuera de mock mode dentro de `scrape_with_page`.
   - Con `SCRAPER_MOCK_MODE=true` por default, riesgo alto de operar sobre datos ficticios.

4. **Observabilidad de rate limit (MEDIO)**
   - Hay retry de 429, pero no hay metrica/log especifica para gobernar presupuesto por cuenta.

## Rate limit projection

- **Estimacion conservadora por cliente/sync**: 80-180 requests.
- **32 clientes**: ~2.5k a ~5.7k requests/sync.
- **100 clientes**: ~8k a ~18k requests/sync.
- Sin cola global ni budget estricto, este volumen es riesgo de degradacion.

## Veredicto ML

- **Estado general**: PARCIALMENTE OPERATIVO.
- **Bloqueantes para produccion real**:
  - CSRF OAuth robusto.
  - Cifrado consistente de tokens en todo el ciclo.
  - Quitar mocks del scraper real.
  - Persistir `data_sources` y conectar sync ML al flujo de formulario end-to-end.
