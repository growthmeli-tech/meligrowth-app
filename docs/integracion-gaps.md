# Gaps de integración detectados

## Gap: Trazabilidad de `data_sources` no persistida en diagnóstico
- **Eslabón roto**: Formulario de diagnóstico -> Supabase (`diagnostics`)
- **Descripción**: El prefill ML llega al formulario y se muestra por fuente, pero el detalle de `data_sources` por bloque/métrica no se guarda al persistir el diagnóstico.
- **Archivo fuente**: `components/diagnostic/diagnostic-form.tsx`
- **Archivo destino**: `lib/diagnostics/persist-diagnostic.ts` + schema `public.diagnostics`
- **Fix recomendado**: Agregar columna JSONB (`data_sources`) en `diagnostics`, extender tipos de Supabase y persistir ese payload en `persistDiagnostic`.
- **Impacto**: No hay auditoría histórica de confiabilidad de datos (API vs scraper vs manual).
- **Prioridad**: CRÍTICO

## Gap: Banner de operator no consume notificaciones persistidas
- **Eslabón roto**: Notificaciones y alertas -> Dashboard operator
- **Descripción**: El `AlertBanner` del dashboard se alimenta por recomendaciones urgentes recalculadas, no por eventos persistidos de `notifications`.
- **Archivo fuente**: `lib/data/recommendations.ts`
- **Archivo destino**: `app/(operator)/operator/dashboard/page.tsx`
- **Fix recomendado**: Unificar `AlertBanner` con feed de `notifications` (o combinar ambos orígenes con prioridad y deduplicación).
- **Impacto**: Riesgo de desalineación entre alertas vistas en dashboard y centro de notificaciones.
- **Prioridad**: IMPORTANTE

## Gap: Reglas de alerta no alineadas 1:1 con contrato de negocio
- **Eslabón roto**: Guardado de diagnóstico -> Creación de alertas automáticas
- **Descripción**: El código de alertas usa umbrales `score_global < 55` y bloques críticos `< 55`, mientras el contrato de integración define foco explícito en `<40` y delta `<-10`.
- **Archivo fuente**: `lib/score-alerts.ts`
- **Archivo destino**: `lib/diagnostics/persist-diagnostic.ts`
- **Fix recomendado**: Alinear umbrales y tipos de alerta con criterio de negocio oficial (requiere decisión de producto).
- **Impacto**: Puede haber sobre-alerta o alertas de severidad distinta a la esperada.
- **Prioridad**: IMPORTANTE

## Gap: Persistencia de `source` a nivel diagnóstico, no por métrica
- **Eslabón roto**: API ML -> Formulario -> Supabase
- **Descripción**: Se persiste `source` global (`manual`/`scraping`) tras submit, pero sin granularidad por campo para trazabilidad fina.
- **Archivo fuente**: `app/(operator)/operator/clients/[id]/diagnostic/new/actions.ts`
- **Archivo destino**: `public.diagnostics`
- **Fix recomendado**: Persistir `source` por bloque o por métrica (JSONB) y exponerlo en vistas de auditoría.
- **Impacto**: Limita análisis de calidad de datos por bloque al revisar diagnósticos históricos.
- **Prioridad**: IMPORTANTE
