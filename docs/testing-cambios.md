# Cambios de testing

## Helpers creados

- `tests/helpers/factories.ts`: factories tipadas de `users`, `clients` y `diagnostics` para escenarios reales (v23 y Platinum).
- `tests/helpers/supabase-mock.ts`: mock reutilizable de cliente Supabase para pruebas de server actions y data layer.
- `tests/helpers/ml-api-mock.ts`: fixtures de respuestas de API ML y prefill del pipeline.

## Unit tests agregados

- `tests/unit/lib/scoring/bloque-salud.test.ts`
- `tests/unit/lib/scoring/bloque-publicaciones.test.ts`
- `tests/unit/lib/scoring/bloque-ads.test.ts`
- `tests/unit/lib/scoring/bloque-logistica.test.ts`
- `tests/unit/lib/scoring/bloque-stock.test.ts`
- `tests/unit/lib/scoring/score-global.test.ts`
- `tests/unit/lib/recommendations/engine.test.ts` (expandido)
- `tests/unit/lib/recommendations/ads-analyzer.test.ts`
- `tests/unit/lib/recommendations/priorities.test.ts`
- `tests/unit/lib/ml/auth.test.ts`
- `tests/unit/lib/ml/mappers.test.ts`
- `tests/unit/lib/ml/pipeline.test.ts`
- `tests/unit/lib/pricing/calculator.test.ts`

## Integration tests agregados

- `tests/integration/actions/diagnostics.test.ts`: persistencia, salida y error de permisos.
- `tests/integration/actions/clients.test.ts`: creación de acción, validaciones y fallo RLS.

## E2E

- Se revisaron los specs existentes de `tests/e2e/**` para mantener compatibilidad con el flujo actual y se conservaron los escenarios críticos definidos.
