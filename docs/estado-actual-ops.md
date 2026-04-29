# Estado actual — MeliGrowth OPS y plataforma v2

**Audiencia:** equipo humano y agentes de código.  
**Alcance:** hechos verificables en el repo a abril 2026, post ronda de mejoras y QA local.  
**No sustituye** la visión de producto en `docs/meligrowth-product-context.md`; **corrige** expectativas donde el código ya divergió del documento histórico.

**Documentos relacionados:** `docs/arquitecto-v2-reporte.md` (auditoría arquitectónica), `docs/meligrowth-product-context.md` (producto), `docs/ux/componentes-spec.md` (UI).

---

## 1. Resumen ejecutivo consolidado

- **La v2 es la base preferida** para cuentas ML, snapshots, salud, alertas, tareas e ingesta: existe `lib/data-v2/*`, RLS en migraciones `0004`–`0006`, y el pipeline ML (`lib/ml/pipeline.ts`) persiste **metric_snapshots**, corre **runRecommendationsPipelineV2** y deja **ingestion_runs** con trazas por bloque.
- **Legacy y v2 conviven** (`clients` / `diagnostics` / `actions` siguen en uso en partes del flujo de diagnóstico y OAuth por `client_id`); la directriz operativa es **no duplicar** nuevas lecturas/escrituras paralelas: preferir capas y tablas ya definidas en `0004` y posteriores.
- El trabajo reciente cerró brechas en **fuente de verdad perceptual** (null ≠ 0 crítico), **semántica de Ads**, **señales cruzadas** (`lib/recommendations/operational-signals.ts`), **persistencia de alertas** (`lib/recommendations/persist.ts`), **UI OPS** (`app/(ops)/ops/**`) y **trazabilidad de ingesta** (`ingestion_runs.blocks_fetched`, `error_kind` en entradas por bloque; `ingestion_quality` en `_meta` al cerrar la corrida).
- **QA:** `npm run test` y `npm run build` OK en el entorno del equipo. **Playwright E2E** no se ejecutó aquí por limitaciones de binarios en sandbox → estado declarado: **listo con riesgos** (ver sección 6).

---

## 2. Qué quedó resuelto (verificable en código)

| Tema | Evidencia principal |
|------|---------------------|
| Cadena v2 ML → snapshot → health → alertas | `lib/ml/pipeline.ts` crea corrida, `createMetricSnapshot`, `runRecommendationsPipelineV2`; `lib/recommendations/pipeline-v2.ts` + `persist.ts` |
| Scoring con Ads sin actividad no como “óptimo” ni auto-crítico | `lib/recommendations/ads-analyzer.ts` (`sin_campanas`, `sin_datos`); `lib/ops/meaningful-ads.ts`; `score_ads` null en health si no hay actividad significativa (`pipeline-v2.ts`) |
| Señales cruzadas en recomendaciones | `lib/recommendations/operational-signals.ts` (stock vs escalar ads, pausadas con stock, tráfico vs catálogo, candidato campaña, brecha integración ads) |
| Trazabilidad ingesta | `lib/data-v2/ingestion-runs.ts`; `lib/ml/pipeline.ts` (`blockEntry`, `classifyFetchError`, `_meta.ingestion_quality`) |
| Scraping jobs v2 | `supabase/migrations/0008_scraping_jobs_ml_account.sql`; inserts con `ml_account_id` en modo v2 (`lib/ml/pipeline.ts`) |
| OPS UI con datos v2 | `app/(ops)/ops/dashboard/page.tsx`, `alerts/page.tsx`, `tasks/page.tsx`, `blocks/**`; `lib/data-v2/viewer.ts` |
| Badges de origen en métricas OPS | `lib/ops/data-source-ui.ts` + `components/ops/metric-row.tsx` |
| Bloque Ads en UI: neutro si sin datos | `components/score/block-scores-row.tsx` (`ads` null → chip distinto, “Sin datos”) |
| RLS tareas operador | `0005_ops_tasks_insert_policy.sql`, `0006_ops_tasks_update_policy.sql` |
| Pasos en alertas/tareas | `supabase/migrations/0007_alerts_tasks_steps.sql` |
| Tipos Supabase incluyen tablas v2 | `lib/supabase/database.types.ts` (tablas públicas v2 presentes) |

---

## 3. Deuda técnica y producto (sigue pendiente)

- **Acceso `/ops` para `internal_operator_meli_growth` (Copilot):** `middleware.ts` solo permite `/ops/**` si el rol es `client_operator` **y** `user_account_access.ops_access_enabled === true`. Los roles internos van a `/internal/dashboard` y **no** entran a `/ops` con la regla actual — desalineado respecto de la matriz deseada en `meligrowth-product-context.md` (sección 3 / 9).
- **Convivencia legacy/v2:** OAuth y partes del pipeline siguen ancladas a `clientId` + opción `mlAccountId`; no eliminar caminos legacy sin plan de corte explícito.
- **`/brand/notifications`:** en el doc de producto figura la ruta; en el árbol actual existe `dashboard` y `metrics` bajo `app/(brand)/brand/` — no asumir rutas no listadas en el repo sin verificar.
- **E2E Playwright:** no validado en CI/sandbox descrito; regresiones de flujo multi-rol quedan cubiertas solo por tests unitarios/integration disponibles.
- **Múltiples `ml_accounts` por company:** el modelo lo permite; varias pantallas usan “cuenta primaria” (`getPrimaryAccountForManager` / `getPrimaryAccountForOperator`) — agregación multi-cuenta en brand puede ser incompleta según caso.
- **Benchmarks en copy de producto vs tablas en código:** posibles matices entre textos de `docs/meligrowth-product-context.md` y umbrales efectivos en `lib/scoring/block-calculations.ts` / `lib/recommendations/benchmarks.ts` — inventario en `docs/auditoria-negocio.md` (convive con tests en verde; no es bloqueante operativo si QA de scoring está OK).

---

## 4. v2 preferida vs legacy (orientación para agentes)

| Área | Preferido (v2) | Legacy aún presente |
|------|----------------|---------------------|
| Identidad de cuenta operativa | `ml_accounts`, `companies`, `users_v2`, `user_account_access` | `clients` vinculado a OAuth / sesiones ML históricas |
| Foto métrica diaria | `metric_snapshots` + `data_sources` jsonb | `diagnostics` para flujos viejos de informe |
| Score persistido | `account_health` (filas ligadas a `snapshot_id`) | Historial/score en modelos viejos según pantalla |
| Alertas / tareas OPS | `alerts`, `tasks`, `task_events` | `notifications`, `actions` en flujos internos legados |
| Ingesta / observabilidad | `ingestion_runs` | Logs solo consola en fallos puntuales |
| Jobs scraper | `scraping_jobs` con `ml_account_id` **o** `client_id` (check `0008`) | Filas solo `client_id` |

**Regla:** nuevas features que toquen “qué pasó hoy en la cuenta” deben leer/escribir **v2** y reutilizar `lib/data-v2/*` salvo decisión explícita de ampliar legacy.

---

## 5. Qué no tocar sin decisión explícita

- **Semántica de scoring global:** invariantes y pesos en el **módulo `lib/scoring/`** (entrada `lib/scoring/index.ts`) — no duplicar en frontend.
- **Contrato de tablas `0004` y siguientes:** no renombrar columnas españolas (`titulo`, `prioridad`, `audiencia`, etc.) sin migración y actualización de `database.types.ts` y `lib/data-v2/*`.
- **Middleware como única capa de ruta para auth por prefijo:** no reimplementar guards en layouts sin revisar `middleware.ts`.
- **Políticas RLS en Supabase:** cambios en `tasks` / `task_events` / `ingestion_runs` afectan operadores y pipeline con service role — coordinar con seguridad.
- **Motor de recomendaciones:** audiencias `internal` \| `manager` \| `operator` \| `all` en `lib/recommendations/types.ts` deben seguir alineadas a columnas `audiencia` en `alerts`.

---

## 6. Riesgos abiertos (redacción para release)

1. **Permisos Copilot vs código:** operación diaria interna en `/ops` puede estar bloqueada para MG según `middleware.ts`; riesgo de UAT fallido o workaround manual (cuentas como `client_operator`).
2. **E2E no ejecutado en entorno sandbox:** riesgo de regresión en navegación, cookies, o flujos server actions no cubiertos por tests.
3. **Dependencia de servicio scraper externo:** si `SCRAPER_SERVICE_URL` / secret faltan, bloques caen a fallback/null con `unavailable` — correcto semanticamente pero puede inflar “sin integración” en UI.
4. **Enriquecimiento Claude:** pipeline evita llamadas duplicadas el mismo día por conteo de alertas; cambios en esa heurística pueden dejar `steps` vacíos o duplicar costo si se altera sin revisar `pipeline-v2.ts`.
5. **Una sola cuenta “primaria”** para operador/manager en varias queries — riesgo de mostrar cuenta equivocada si hay varias `ml_accounts` activas.

---

## 7. Fuente de verdad (por dominio)

| Dominio | Tabla(s) / registro | Lectura/escritura típica en app |
|---------|---------------------|--------------------------------|
| **Cuentas (empresa + ML)** | `companies`, `ml_accounts`, `user_account_access`, `users_v2` | `lib/data-v2/companies.ts`, `ml-accounts.ts`, `viewer.ts` |
| **Snapshots** | `metric_snapshots` (único por `ml_account_id` + `snapshot_date` en `0004`) | `lib/data-v2/metric-snapshots.ts`; escritura desde `lib/ml/pipeline.ts` |
| **Scoring (reglas en código)** | — (no tabla SQL dedicada) | Solo `lib/scoring/` (`metric-semantics`, `block-calculations`, `metric-snapshot`, …); resultado persistido en `account_health` |
| **Account health** | `account_health` | `lib/data-v2/account-health.ts`; insert desde `lib/recommendations/pipeline-v2.ts` |
| **Alerts** | `alerts` (+ `steps` jsonb desde `0007`) | `lib/data-v2/alerts.ts`; bulk `createAlertsBulk` vía `lib/recommendations/persist.ts` |
| **Tasks** | `tasks`, `task_events` | `lib/data-v2/tasks.ts`; actions en `app/(ops)/ops/tasks/actions.ts`, `app/(internal)/internal/clients/[id]/tasks/actions.ts` |
| **Scraping jobs** | `scraping_jobs` (`client_id` o `ml_account_id`, check `0008`) | `lib/ml/pipeline.ts` (`triggerScrapeJob`) |

**Nota:** la correlación OAuth/tokens con “cliente legacy” puede seguir siendo la fuente operativa de **credenciales** aunque el destino de métricas sea v2 — ver rutas `/internal/clients/.../settings` y callback ML.

---

## 8. Criterios semánticos vigentes

### 8.1 Ads sin campañas / sin actividad

- **Sin gasto ni ventas ads y sí ventas totales:** `analyzeAds` → `estado_salud: "sin_campanas"` — **no** se interpreta como performance excelente por ACOS/ROAS en cero.
- **Faltan inputs o ventas totales en cero:** `sin_datos` — priorizar completar datos o integración, no mensaje de “crítico” por ceros aislados.
- **Actividad mínima para score de bloque Ads:** `hasMeaningfulAdsActivity` (gasto o ventas ads > 0). Sin eso, `score_ads` en `account_health` puede ser **null** y el peso de Ads se maneja en el módulo `lib/scoring/` (`block-calculations`, etc.; exclusión/redistribución ya definida allí).

### 8.2 null vs 0 en OPS

- **null:** ausencia de dato o bloque no aplicable al cierre del snapshot — la UI OPS debe mostrar **“Sin datos”** / badges neutros, **no** semáforo rojo por “cero”.
- **0:** valor numérico explícito del snapshot (puede ser legítimo o crítico según métrica); distinguir de null siempre en componentes de bloque y filas de métrica (`lib/ops/metrics.ts`).

### 8.3 Proxy (label UI)

- Origen `scraper` en `data_sources` se muestra como **“Proxy”** (`lib/ops/data-source-ui.ts`): scraping o heurística, menor garantía que API oficial.

### 8.4 Sample-based (estado real en código)

- No existe un valor `sample` en el tipo `MlDataSource` (`lib/ml/mappers/types.ts`: solo `api` \| `scraper` \| `manual` \| `unavailable`).
- Muestreo parcial en endpoints (p. ej. stock) sigue clasificándose como **`api`** a nivel de fuente de bloque salvo que el pipeline marque otro origen. Si en producto se requiere badge explícito “sample-based”, es **evolución** pendiente (tipos + ingesta + UI).

### 8.5 Manual

- Origen `manual` o carga formulario/planilla; badge **Manual** en OPS.

### 8.6 Sin integración

- Origen `unavailable`: badge **Sin integración** — significa **falta de fuente conectada**, no “métrica mala”. En cruces, `integrationGapAds` combina `data_sources.ads === "unavailable"` con falta de actividad significativa en ads (`operational-signals.ts`).

---

## 9. Rutas OPS existentes (no inventar otras)

Verificadas bajo `app/(ops)/ops/`:

- `/ops/dashboard`
- `/ops/alerts`
- `/ops/tasks`
- `/ops/blocks` y `/ops/blocks/[bloque]`

---

## 10. Migraciones citadas en este estado

| Archivo | Rol |
|---------|-----|
| `supabase/migrations/0004_new_model_360.sql` | Schema core v2 |
| `0005_ops_tasks_insert_policy.sql` | INSERT tasks/events operador |
| `0006_ops_tasks_update_policy.sql` | UPDATE tasks operador |
| `0007_alerts_tasks_steps.sql` | Columna `steps` |
| `0008_scraping_jobs_ml_account.sql` | `scraping_jobs.ml_account_id` nullable `client_id` |

---

*Última revisión documental: alineada con el tree del repo en la sesión de documentación (abril 2026).*
