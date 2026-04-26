# Reporte de Integración — Meli Growth

## Estado de la cadena
[1] API ML -> Formulario de diagnóstico: ✅  
[2] Formulario -> Supabase: ⚠️  
[3] Supabase -> score_history trigger: ✅  
[4] Diagnóstico -> Motor de Recomendaciones: ✅  
[5] Motor -> UI Operator: ✅  
[6] Score -> Dashboard Cliente: ✅  
[7] Notificaciones y alertas: ⚠️

## Gaps encontrados
- **CRÍTICO**: falta persistencia de `data_sources` por bloque/métrica al guardar diagnóstico.
- **IMPORTANTE**: `AlertBanner` operator usa recomendaciones urgentes y no feed unificado de `notifications`.
- **IMPORTANTE**: umbrales de `generateScoreAlerts` no están alineados 1:1 con contrato funcional esperado.
- **IMPORTANTE**: `source` persiste solo a nivel global del diagnóstico y no granular por métrica.

Ver detalle completo en `docs/integracion-gaps.md`.

## Fixes aplicados directamente
- Integré prefill automático desde ML al formulario (`POST /api/ml/sync`) con timeout de 5s y degradación manual no bloqueante.
- Conecté `data_sources` del prefill al render por campo/bloque (badges `API`, `Scraper`, `Manual`, `Sin dato`).
- Propagué `source` real del submit (`manual`/`scraping`) desde formulario hacia `createDiagnostic`.
- Añadí `getDiagnosticHistory()` y `getDiagnosticWithDelta()` en la capa de datos para contrato explícito de dashboard cliente.
- Integré delta real y traducción de estado simple en `client/dashboard`.
- Integré `getDiagnosticHistory()` en `client/metrics` para gráfico de evolución.
- Agregué notificación automática `accion_completada` al usuario cliente tras guardar diagnóstico exitosamente.
- Creé `tests/integration/e2e-chain.test.ts` para validar contratos críticos de la cadena.

## Fixes pendientes para otros agentes
- Persistir `data_sources` en schema/DB (`diagnostics`) y exponer auditoría histórica por bloque.
- Alinear criterios de alertas automáticas con definición final de negocio (producto/datos).
- Unificar origen de alertas del dashboard operator con sistema de notificaciones persistidas.

## Veredicto
⚠️ **CADENA PARCIAL — funciona con limitaciones controladas**

La cadena operativa principal (diagnóstico -> persistencia -> recomendaciones -> UI -> dashboard cliente) funciona end-to-end.  
No está aprobada como cadena “completa” por trazabilidad incompleta de fuente de datos y desalineación parcial en alertabilidad.
