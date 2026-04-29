# Reporte Arquitecto V2

**Última actualización:** abril 2026 (post mejoras OPS, pipeline v2 y QA local).

**Documento operativo complementario:** `docs/estado-actual-ops.md` — estado consolidado, fuentes de verdad, criterios semánticos y riesgos para agentes. Este reporte retiene la **mirada arquitectónica**; el detalle “qué tocar / qué no” vive allí.

---

## Sección 1 — Resumen ejecutivo

- El schema **0004** (`companies`, `ml_accounts`, `metric_snapshots`, `account_health`, `alerts`, `tasks`, `ingestion_runs`, …) **está en uso** por la aplicación: capa `lib/data-v2/*`, pipeline en `lib/ml/pipeline.ts` + `lib/recommendations/pipeline-v2.ts`, y vistas **internal** (detalle de cliente/company), **brand** (dashboard + métricas) y **ops** (dashboard, alertas, tareas, bloques).
- La cadena objetivo **`API ML → metric_snapshots → account_health → alerts → (tasks) → UI`** está **implementada para el camino v2** cuando el fetch ML corre con `mlAccountId` y persistencia habilitada; coexisten rutas y datos **legacy** (`clients`, `diagnostics`, OAuth por `client_id`) — ver `docs/estado-actual-ops.md` sección 4.
- El cuello de botella que motivó trabajo reciente (fuente de verdad percibida, permisos, trazabilidad, semántica Ads, coherencia dato–alerta–tarea–UI) está **parcialmente cerrado en código**; quedan **gaps de permisos de ruta** y **E2E** documentados como riesgos.

---

## Sección 2 — Estado de las 3 vistas (real)

| Vista | Ruta base | Conectada a schema v2 | Notas |
|-------|-----------|----------------------|--------|
| Internal | `/internal/**` | **Sí** (detalle company/cuenta: health, snapshots, alertas v2) | Alta/onboarding y flujos históricos pueden seguir tocando legacy; redirección `/operator` → `/internal` en `middleware.ts`. |
| Brand | `/brand/**` | **Sí** (datos v2 en dashboard/metrics según implementación actual) | Verificar rutas concretas en `app/(brand)/brand/` antes de asumir notificaciones si no existen en el tree. |
| Ops | `/ops/**` | **Sí** | Dashboard, alertas, tareas, bloques consumen `lib/data-v2/*`. **Restricción middleware:** solo `client_operator` con `ops_access_enabled`; ver deuda en `estado-actual-ops.md`. |

---

## Sección 3 — Estado de la cadena de datos

| Eslabón | Estado |
|---------|--------|
| API ML / scraper (`lib/ml/pipeline.ts`) | **Activo**; registra `ingestion_runs`, `blocks_fetched` por bloque con `error_kind` / mensaje; cierra con `_meta.ingestion_quality` (`partial` \| `full`). |
| `metric_snapshots` | **Escritura activa** vía `createMetricSnapshot` (`lib/data-v2/metric-snapshots.ts`) desde pipeline cuando aplica v2. |
| `account_health` | **Escritura activa** en `runRecommendationsPipelineV2` (`lib/recommendations/pipeline-v2.ts`). |
| `alerts` | **Escritura activa** vía `persistRecommendationsAsAlerts` (`lib/recommendations/persist.ts`) con filtro de prioridades y señales cruzadas. |
| `tasks` | **Lectura/escritura** en OPS e internal; políticas RLS `0005`/`0006`. |
| UI por rol | **Consume** datos procesados en brand/ops/internal para tramos v2; scoring sigue centralizado en el módulo `lib/scoring/` (sin duplicar en frontend). |

---

## Sección 4 — Motor de recomendaciones y modelo v2

- El motor (`lib/recommendations/engine.ts`) recibe contexto enriquecido con **señales operativas** (`operational-signals.ts`) y **análisis Ads** (`ads-analyzer.ts`) alineados a audiencias `internal` \| `manager` \| `operator` \| `all` en `lib/recommendations/types.ts`, coherentes con columna `audiencia` en tabla `alerts` (`0004`).
- Persistencia selectiva de alertas y enriquecimiento opcional de pasos (Claude) en `pipeline-v2.ts`; columnas `steps` en `0007`.

---

## Sección 5 — Gaps ordenados por impacto (actualizados)

| Severidad | Tema | Archivos / notas |
|-----------|------|------------------|
| **Alto** | `internal_operator_meli_growth` (y super_admin) **no** cumplen la matriz producto para `/ops/**` con la regla actual de `middleware.ts`. | `middleware.ts`; comparar con `docs/meligrowth-product-context.md`. |
| **Alto** | E2E Playwright no validado en entorno sandbox del último QA. | Suite bajo `tests/` según repo. |
| **Medio** | Convivencia legacy/v2 en OAuth y `client_id` — riesgo de doble mantenimiento si se agregan lecturas fuera de `lib/data-v2`. | `lib/ml/pipeline.ts`, rutas internal settings. |
| **Medio** | Cuenta “primaria” para operador/manager con múltiples `ml_accounts`. | `lib/data-v2/viewer.ts`. |
| **Menor** | Documentación de producto (rutas middleware en snippet) puede estar desactualizada vs código. | Actualizar `meligrowth-product-context.md` solo con revisión explícita de producto. |

Los ítems históricos del reporte 2025 (placeholders brand/ops, “no hay lib/data-v2”, “database.types solo legacy”) **ya no aplican**.

---

## Sección 6 — Compatibilidad schema viejo vs nuevo

- **Legacy activo:** OAuth, sesiones, parte de naming `clientId` en pipeline ML, posibles diagnósticos y acciones en flujos no migrados.
- **v2 activo:** tablas `0004`+ en uso por app; tipos en `lib/supabase/database.types.ts` incluyen entidades v2.
- **Scraping:** `0008` permite jobs por `ml_account_id` sin `client_id`.

---

## Sección 7 — Roadmap para otros agentes (resumido)

1. **Cerrar gap Copilot `/ops`:** alinear `middleware.ts` y `user_account_access` con reglas de negocio aprobadas.
2. **E2E por rol:** cuando el entorno permita binarios Playwright, cubrir `/internal`, `/brand`, `/ops`.
3. **Reducir dualidad legacy/v2:** plan de corte o capa única de entrada para “cuenta activa” y tokens ML.
4. **Multi-cuenta:** UX y queries explícitas por `ml_account_id` seleccionado.

Detalle de “qué está resuelto / qué no” → `docs/estado-actual-ops.md`.

---

## Sección 8 — Checklist Go Live (ajustado)

- [x] Pipeline que escribe `metric_snapshots` + `account_health` + alertas v2 en flujo ML v2.
- [x] Trazabilidad `ingestion_runs` con bloques y calidad de corrida en metadata.
- [x] UI OPS con bloques, null seguro en Ads, badges de fuente.
- [ ] Middleware y RLS validados para **todos** los casos producto (incl. Copilot en `/ops`).
- [ ] E2E estable en CI.
- [ ] Población real `users_v2` / `user_account_access` en producción validada con UAT.
- [ ] Monitoreo de corridas fallidas en entorno productivo (fuera del alcance de este doc).

---

## Sección 9 — Preguntas abiertas (heredadas; no resueltas en código)

- Regla final de acceso **Copilot** a `/ops` vs solo `/internal`.
- Mantener o retirar compatibilidad **diagnostics/actions** como fuente paralela.
- Agregación **multi `ml_account`** en brand desde primer release.
- Pool de operadores vs **1 operador por cuenta**.
- **Backfill** histórico legacy → v2 (si se necesita continuidad de series).

---

*Fin del reporte. Para tablas exactas y nombres de columnas, la migración fuente sigue siendo `supabase/migrations/0004_new_model_360.sql` y migraciones posteriores numeradas.*
