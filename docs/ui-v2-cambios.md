# UI v2 cambios (modelo 360)

- `components/score/score-display.tsx`: se reimplementaron variantes `lg/md/sm` con clases de spec UX, count-up `800ms`, y estados `loading/empty/error`; implementa `docs/ux/componentes-spec.md` (ScoreDisplay).
- `components/score/block-scores-row.tsx`: nueva fila de 5 chips con peor bloque destacado, modo interactivo, responsive mobile overflow y estados `loading/empty/error`; implementa `docs/ux/componentes-spec.md` (BlockScoresRow).
- `components/company/company-card.tsx`: card diferenciada por plan (`360` azul, `Copilot` amarillo), alerta urgente en chip y CTA `Ver cuenta`; implementa `docs/ux/componentes-spec.md` (CompanyCard). Depende de `PlanBadge` y `ScoreDisplay`.
- `components/recommendations/recommendation-card.tsx`: soporte de variantes `operator` y `manager` con copy/CTA diferenciados y prioridad por borde izquierdo; implementa `docs/ux/componentes-spec.md` y `docs/ux/panel-recomendaciones.md`.
- `components/alerts/alert-banner.tsx`: banner de urgencia/alta con pulso y top 3 alertas clickeables; implementa `docs/ux/componentes-spec.md` (AlertBanner).
- `components/diagnostic/diagnostic-field-benchmark.tsx`: input con benchmark inline, debounce `300ms`, badges de fuente y feedback en blur; implementa `docs/ux/componentes-spec.md` + `docs/ux/formulario-diagnostico.md`.
- `components/ops/priority-list.tsx`: lista `HOY HACES ESTO` con ranking, hover arrow y estados `loading/empty/error`; implementa `docs/ux/componentes-spec.md` + `docs/ux/vista-ops.md`.
- `components/charts/score-evolution-chart.tsx`: gráfico recharts de evolución 6 meses con área + línea principal, dot final destacado y estados; implementa `docs/ux/componentes-spec.md` (ScoreEvolutionChart).
- `components/ui/plan-badge.tsx`: badge plan `360°` y `Copilot` con clases exactas de spec; implementa `docs/ux/componentes-spec.md` (PlanBadge).
- `components/tasks/task-card.tsx`: card de tarea con estilos por estado (`pendiente/en_curso/completada/descartada`) y acciones; implementa `docs/ux/componentes-spec.md` (TaskCard).
- `components/ui/empty-state.tsx`: rediseño completo con copy por contexto y CTA por estado; implementa `docs/ux/componentes-spec.md` (EmptyState).
- `components/ui/loading-skeleton.tsx`: variantes `score-hero`, `recommendation-list`, `company-table`, `diagnostic-form`, `chart`; implementa `docs/ux/componentes-spec.md` (LoadingSkeleton).

- `components/recommendations/recommendations-panel.tsx`: ahora consume cuentas/alertas v2 (`lib/data-v2`) y mantiene orden por prioridad + agrupación; implementa requerimiento de no fetch directo en componente y uso de capa de datos.

- `app/(internal)/internal/layout.tsx`: sidebar fija desktop con logo MG, navegación con badges y footer de usuario; implementa `docs/ux/dashboard-internal.md`.
- `app/(internal)/internal/dashboard/page.tsx`: dashboard interno conectado a `lib/data-v2/dashboard-internal.ts`, alertas críticas arriba y tabla/cartera en orden de riesgo; implementa `docs/ux/dashboard-internal.md`.
- `app/(internal)/internal/clients/page.tsx`: nueva vista de cartera con `CompanyCard` y orden por score ascendente; implementa tarea de vista interna clientes.
- `app/(internal)/internal/clients/[id]/page.tsx`: vista cuenta con `ScoreDisplay lg`, `BlockScoresRow` y `RecommendationsPanel`; implementa `docs/ux/vista-cuenta.md`.

- `app/(brand)/brand/layout.tsx`: layout gerencial con navegación simple; implementa `docs/ux/dashboard-client.md`.
- `app/(brand)/brand/dashboard/page.tsx`: dashboard gerencial consumiendo `lib/data-v2/account-health.ts` + `lib/data-v2/alerts.ts`; implementa `docs/ux/dashboard-client.md`.
- `app/(brand)/brand/metrics/page.tsx`: nueva vista de métricas con `ScoreEvolutionChart`; implementa `docs/ux/dashboard-client.md`.

- `app/(ops)/ops/layout.tsx`: layout mobile-first con bottom nav y versión desktop lateral; implementa `docs/ux/vista-ops.md`.
- `app/(ops)/ops/dashboard/page.tsx`: dashboard operativo con `PriorityList`, alertas del día y bloques; implementa `docs/ux/vista-ops.md`.
- `app/(ops)/ops/alerts/page.tsx`: nueva lista de alertas con `RecommendationCard` variante operator; implementa `docs/ux/vista-ops.md` + `docs/ux/panel-recomendaciones.md`.
- `app/(ops)/ops/tasks/page.tsx`: nueva lista de tareas con `TaskCard`; implementa `docs/ux/vista-ops.md`.

- `app/page.tsx`: redirección por roles v2 (`users_v2`) para los 4 roles del modelo 360; implementa requerimiento de acceso por rol.
- `lib/data-v2/viewer.ts`: helpers de sesión/perfil/cuenta primaria para vistas `brand` y `ops`; dependencia para evitar queries directas fuera de capa `data-v2`.
- `lib/data-v2/index.ts`: export de `viewer.ts`.
- `lib/config/design-tokens.ts`: ajuste de clases semáforo y badges para alinear implementación con spec UX y mantener origen de colores en tokens.
