# Contratos entre módulos — Meli Growth

## `lib/ml/pipeline.ts` -> Formulario de diagnóstico
**Tipo exportado**: `MlDiagnosticPrefill`  
**Consumido por**: `components/diagnostic/diagnostic-form.tsx` (vía `POST /api/ml/sync`)  
**Estado**: ✅

## `createDiagnostic` -> `DiagnosticResultScreen`
**Tipo exportado**: `ActionResult<{ diagnostic: DiagnosticRow; recommendations: DiagnosticRecommendations }>`  
**Consumido por**: `components/diagnostic/diagnostic-form.tsx` -> `components/diagnostic/diagnostic-result-screen.tsx`  
**Estado**: ✅

## `lib/recommendations/engine.ts` -> `RecommendationsPanel`
**Tipo exportado**: `DiagnosticRecommendations`  
**Consumido por**: `lib/data/recommendations.ts` y `components/recommendations/recommendations-panel.tsx`  
**Estado**: ✅

## `lib/data/diagnostics.ts` -> `ClientScoreHero`
**Tipo exportado**: `{ current: DiagnosticRow; delta: number | null }` + `getEstadoSimpleParaCliente()`  
**Consumido por**: `app/(client)/client/dashboard/page.tsx` y `components/client/client-score-hero.tsx`  
**Estado**: ✅

## `lib/data/diagnostics.ts` -> `ScoreHistoryChart` (cliente)
**Tipo exportado**: `ActionResult<HistoryPoint[]>` desde `getDiagnosticHistory()`  
**Consumido por**: `app/(client)/client/metrics/page.tsx`  
**Estado**: ✅

## `lib/data/dashboard.ts` / `lib/data/notifications.ts` -> `AlertBanner`
**Tipo exportado**: recomendaciones urgentes + contador de notificaciones  
**Consumido por**: `app/(operator)/operator/dashboard/page.tsx` y `components/alerts/alert-banner.tsx`  
**Estado**: ⚠️ (orígenes de alertas no unificados)
