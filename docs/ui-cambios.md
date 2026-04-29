# Cambios UI implementados

- `app/page.tsx`: redirección por sesión y rol (`operator` / `client`) con fallback a `/login`; implementa fix de auditoría para `/`.
- `components/score/score-display.tsx`: nuevo componente de score global con tamaños, delta y animación; implementa specs de `vista-cuenta.md` y `dashboard-client.md`.
- `components/score/block-scores-row.tsx`: nueva fila compacta de 5 bloques con semáforo y destaque del peor bloque; implementa specs de `vista-cuenta.md`.
- `components/recommendations/recommendation-card.tsx`: nueva card de recomendación con prioridad, acción concreta y CTAs; implementa specs de `panel-recomendaciones.md`.
- `components/recommendations/recommendations-panel.tsx`: nuevo panel con estrategia general, orden por prioridad y empty/error state; implementa specs de `vista-cuenta.md` y `panel-recomendaciones.md`. Depende de `lib/data/recommendations.ts`.
- `components/alerts/alert-banner.tsx`: nuevo banner para alertas nivel 1/2 con CTA y enlaces a cuenta; implementa specs de `dashboard-operator.md` y `sistema-notificaciones.md`.
- `components/diagnostic/diagnostic-field-benchmark.tsx`: nuevo campo de diagnóstico con benchmark inline en tiempo real, estado semáforo y badge de fuente; implementa specs de `formulario-diagnostico.md`.
- `components/diagnostic/block-score-realtime.tsx`: nuevo bloque de score en tiempo real con debounce y barra de progreso; implementa specs de `formulario-diagnostico.md`. Depende de `@/lib/scoring` (módulo `lib/scoring/`).
- `components/diagnostic/diagnostic-result-screen.tsx`: nueva pantalla post-guardado con score final, recomendaciones y CTAs; implementa specs de `formulario-diagnostico.md`.
- `components/client/client-score-hero.tsx`: nuevo hero de cliente con lenguaje simple, delta y fondo contextual; implementa specs de `dashboard-client.md`.
- `components/ui/empty-state.tsx`: nuevo estado vacío reusable con CTA por contexto; implementa reglas de `agente-ui.mdc` y `auditoria-pantallas.md`.
- `components/ui/loading-skeleton.tsx`: nuevos skeletons por variante para estados de carga; implementa reglas de `agente-ui.mdc`.
- `app/(operator)/operator/dashboard/page.tsx`: integra `AlertBanner`, bloque top 3 de riesgo y mejora estado vacío con CTA; implementa fix crítico de auditoría para `/operator/dashboard`.
- `app/(operator)/operator/clients/[id]/page.tsx`: integra `ScoreDisplay` dominante, `BlockScoresRow` y `RecommendationsPanel` visible sobre tabs; implementa fix crítico de auditoría para `/operator/clients/[id]`.
- `components/diagnostic/diagnostic-form.tsx`: refactor completo para benchmark inline, score realtime por bloque, submit con loading y post-submit con `DiagnosticResultScreen`; implementa fix crítico para `/operator/clients/[id]/diagnostic/new`.
- `app/(operator)/operator/clients/[id]/diagnostic/new/page.tsx`: adapta la server action para recibir y renderizar resultado post-guardado.
- `app/(client)/client/dashboard/page.tsx`: integra `ClientScoreHero` y traducción más simple del estado por área; implementa fix de auditoría para `/client/dashboard`.
- `components/notifications/notification-list.tsx`: orden por severidad y copy más amigable en vista cliente; implementa fix de auditoría para `/client/notifications` y mejora de `/operator/notifications`.
