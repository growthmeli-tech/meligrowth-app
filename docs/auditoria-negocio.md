## Integridad de scoring

- **Pesos globales**: Cumple 100 (35/20/20/15/10) en `lib/scoring.ts`.
- **Cap inteligente Salud**: **No cumple** la regla esperada (`<40 => 55`, `40-54 => 72`). Implementacion actual aplica cap 55 cuando cualquier metrica del bloque <45, y ademas aplica ese patron a todos los bloques.
- **Rango score global 0-100**: Parcial. Cada metrica se clamp a 0..100, pero `calcScoreGlobal` no hace clamp final explicito.
- **Estados de score**: **No cumple** la grilla de 6 estados requerida (falta `muy_bueno`, y `riesgo` arranca en 55, dejando 40-54 dentro de critico).

## Ads: formulas y decisiones

- **ACOS/ROAS/TACOS**: Cumple formulas matematicas en `lib/recommendations/ads-analyzer.ts` y `lib/ml/endpoints/ads.ts`.
- **ROAS break-even**: Cumple (`1 / (margen_pre_ads/100)`).
- **Regla TACOS > 65% del margen => urgente**: Cumple en `analyzeAds()`.
- **"Sin datos Ads no penaliza"**: **No cumple** en flujo manual actual. `DiagnosticForm` rellena faltantes con `0`, por lo que bloque Ads puede penalizar por ausencia de datos en vez de quedar neutro.

## Motor de recomendaciones

- **Motor dedicado**: Existe (`lib/recommendations/engine.ts`) y genera recomendaciones por metrica + analisis Ads.
- **Orden por prioridad**: Cumple via `sortByPriority`.
- **IDs unicos**: Cumple por composicion `diagnostic.id + metrica`.
- **Cuenta Platinum sin urgentes**: Riesgo medio. No hay guard explicito "hard-stop"; en escenarios borde una regla por metrica podria marcar urgente aunque el global sea alto.

## Consistencia benchmarks negocio

- **Inconsistencia detectada**: `lib/scoring.ts` y `lib/recommendations/benchmarks.ts` usan umbrales distintos para varias metricas (ej. `pubs_activas_pct`, `reclamos`, `roas`).
- **Impacto**: Puede mostrar score "solido" pero recomendacion "en riesgo" para la misma metrica.
- **Accion**: Centralizar benchmark canonico en una sola fuente y derivar score + recomendaciones desde ese contrato.

## Pipeline ML y dato confiable

- **Mapeo `delayed_handling_time.rate` invertido**: Cumple (`(1-rate)*100`) en `mapReputationToDiagnostic`.
- **Conversion de porcentaje decimal ML**: Cumple para `claims/cancellations/negative` con `*100`.
- **Persistencia de `data_sources`**: **No cumple**. El pipeline produce `data_sources`, pero `diagnostics` no tiene columna para guardarlo ni se persiste en guardado.
- **Fallback por bloque sin dato falso**: Parcial. Cuando falla API, intenta scraper y deja `null` en varios campos; pero la UI no integra aun el sync ML para reflejarlo de punta a punta.

## Calculadora de negocio

- **Formula de precio ML requerida** (`(costo+envio+costoFijo)/(1-comision-publicidad-margen)`): **No implementada** en el modulo actual.
- **Constante comision ML 13.75% en `lib/config/constants.ts`**: **No existe**.
- **Riesgo**: La calculadora actual (`lib/pricing.ts`) es comercial de fee MG, no de precio final ML. Hay desalineacion entre requerimiento funcional y codigo disponible.
