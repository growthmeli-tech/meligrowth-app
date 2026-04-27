# Cambios de Alertas y Reportes PDF

## Objetivo
Se cerraron dos bloques productivos:
- Navegación y gestión operativa de alertas internas (`/internal/alerts`).
- Generación de reporte gerencial en PDF descargable desde la cuenta y post-diagnóstico.

## Archivos creados

### `app/(internal)/internal/alerts/page.tsx`
- Nueva pantalla de alertas internas.
- Lista alertas v2 (`alerts`) con company, prioridad, título, descripción, acción concreta y fecha.
- Filtros por prioridad, company y estado (`pendiente`, `resuelta`, `all`).
- Empty state: `"No hay alertas activas. Tu cartera está al día ✅"`.
- Acción por fila para marcar alerta como resuelta.

### `app/(internal)/internal/alerts/actions.ts`
- Server action `resolveAlert(formData)`.
- Actualiza `alerts.resuelta = true` y `alerts.resuelta_at = now()`.
- Revalida `/internal/alerts` y `/internal/dashboard`.

### `lib/reports/generate-diagnostic-report.ts`
- Contrato `DiagnosticReportData`.
- Función pura `toManagerLanguage()` para traducción técnico → gerencial.
- Función `generateDiagnosticReport()` para construir el modelo visual del PDF (resumen, estado, color y alertas traducidas).

### `components/reports/diagnostic-pdf.tsx`
- Documento PDF con `@react-pdf/renderer`.
- Incluye:
  - Header premium oscuro (`#1A1A1A`) con acento amarillo (`#FFD600`).
  - Score global dominante.
  - Resumen ejecutivo en lenguaje gerencial.
  - Estado por área (5 bloques).
  - Alertas prioritarias (top 3).
  - Próximos pasos (top 3).
  - Footer institucional.

### `components/reports/download-report-button.tsx`
- Botón cliente usando `PDFDownloadLink`.
- Estados:
  - loading: `"Generando PDF..."`
  - normal: `"Descargar reporte"` o label custom.
- Nombre de archivo: `reporte-{company_slug}-{fecha}.pdf`.
- Variante deshabilitada con tooltip.

## Archivos modificados

### `components/alerts/alert-banner.tsx`
- CTA `"Ver todas →"` ahora navega a `/internal/alerts`.

### `app/(internal)/internal/layout.tsx`
- Sidebar `"Alertas"` ahora navega a `/internal/alerts`.
- Badge mantiene conteo de urgentes no resueltas de la cartera.

### `lib/data-v2/alerts.ts`
- Nueva función `listInternalAlerts()`:
  - respeta filtros de prioridad/company/estado.
  - ordena por prioridad (`urgente > alta > media > baja`) y luego `created_at desc`.
  - resuelve `company_name` via `ml_accounts + companies`.

### `app/(internal)/internal/clients/[id]/page.tsx`
- Integración del botón `Descargar reporte` en el header junto a `Nuevo diagnóstico`.
- Botón habilitado solo si hay diagnóstico (`account_health`), deshabilitado en caso contrario.
- Construcción de `reportData` desde `account_health + alerts + historial`.

### `app/(internal)/internal/clients/[id]/diagnostic/new/actions.ts`
- El submit del diagnóstico ahora retorna `reportData` además de `diagnostic` y `recommendations`.
- `reportData` se arma con datos recién persistidos para habilitar descarga inmediata post-guardado.

### `components/diagnostic/diagnostic-form.tsx`
- Se actualizó payload de guardado para transportar `reportData` al resultado.

### `components/diagnostic/diagnostic-result-screen.tsx`
- Integración del botón `"Descargar reporte gerencial"` inmediatamente después del guardado.

## Dependencias agregadas
- `@react-pdf/renderer`
- `@types/react-pdf`

## Decisiones de implementación
- Se priorizó modelo v2 (`alerts`, `account_health`, `ml_accounts`, `companies`) para evitar regresiones al flujo legacy.
- La traducción técnico → gerencial se encapsuló en funciones puras testables en `lib/reports/generate-diagnostic-report.ts`.
- La acción de resolver alertas es server-side para mantener consistencia con permisos y RLS.
