# MELI GROWTH APP — AGENT CONTEXT DOCUMENT
> **Version:** 10x — Modelo 360° y 360° Copilot  
> **Audiencia:** Agentes de desarrollo (LLM coding agents, Cursor, Copilot, Claude Code)  
> **Fuente de verdad:** Este archivo. Si hay conflicto con el código → el código está mal.

---

## ⛔ PROTOCOLO OBLIGATORIO PARA AGENTES

Antes de escribir **cualquier línea de código**, el agente debe:

1. **Leer este documento completo.** No asumir nada que no esté acá.
2. **Verificar en qué fase está el trabajo** → Sección 15 (Roadmap).
3. **Para cada función nueva**, verificar:
   - ¿La lógica de negocio pertenece a `lib/`? → Sí → va en `lib/`. Nunca en el frontend.
   - ¿Involucra scoring? → Solo en el módulo `lib/scoring/` (entrada `lib/scoring/index.ts`).
   - ¿Involucra permisos de ruta? → Solo en `middleware.ts`.
   - ¿Involucra constantes del negocio? → Solo en `lib/config/constants.ts`.
4. **Antes de crear una ruta nueva**, verificar que no existe ya en Sección 9.
5. **Antes de agregar una tabla nueva al schema**, verificar Sección 8.

### Estado actual del proyecto
```
- Sin clientes reales. Solo datos de prueba (ver Sección 17).
- Los datos de diagnóstico del Drive son fixtures para validar el motor de scoring.
- Los datos reales de cuentas vendrán via OAuth de ML cuando cada cliente conecte su cuenta.
- Los campos que la API de ML no cubre se cargan manualmente via planillas.
```

---

## 1. QUÉ ES ESTE PRODUCTO

**Definición funcional:** Plataforma SaaS operativa para sellers de Mercado Libre. Convierte datos dispersos en decisiones priorizadas y accionables.

**No es:** un dashboard de métricas, un panel de analytics, un bot de automatización.

**Las 3 preguntas que la app responde siempre:**
1. ¿Cómo está la cuenta? → `account_health.score_global` + estado cualitativo
2. ¿Cuál es el problema principal? → `alerts` filtradas por `priority = 'urgente' | 'alta'`
3. ¿Qué conviene hacer hoy? → `tasks` pendientes ordenadas por impacto + top 5 prioridades del día

**Flujo de valor (pipeline unidireccional):**
```
Data Sources → metric_snapshots → scoring (`lib/scoring/`) → account_health → alerts → tasks → Vistas
```
Cada flecha es una responsabilidad separada. Nunca saltear pasos.

---

## 2. PLANES COMERCIALES

### Tipos de plan (campo `companies.plan_type`)
```typescript
type PlanType = '360' | '360_copilot'
```

| Atributo | Plan 360° | Plan 360° Copilot |
|---|---|---|
| Precio | USD 800/mes | USD 800/mes + 5% sobre sell out generado |
| Quién opera la cuenta | Equipo del cliente | Equipo interno de Meli Growth |
| Rol de MG | Monitoreo y soporte | Operación diaria |
| Vista interna activa | Monitoreo | Operación completa |
| Quién usa `/ops/` | `client_operator` del cliente | `internal_operator_meli_growth` de MG |

### Regla crítica de implementación
> ⛔ **NUNCA crear dos apps separadas.** Los 2 planes son el mismo núcleo con distintos permisos.  
> El campo `plan_type` en `companies` más la tabla `user_account_access` resuelven toda la diferencia.

---

## 3. VISTAS DEL SISTEMA

> Las vistas **nunca calculan lógica de negocio**. Solo consumen datos ya procesados.

### Vista 1 — Interna Meli Growth
- **Ruta base:** `/internal/`
- **Roles con acceso:** `super_admin_meli_growth`, `internal_operator_meli_growth`
- **Propósito:** gestionar la cartera de cuentas sin perder foco de cuál necesita atención hoy
- **Criterio de éxito:** el equipo puede gestionar 32 cuentas desde esta vista

**Contenido MVP:**
- Lista de companies con nombre, plan, score global, estado, responsable interno
- Filtros: `plan_type`, `score_global`, `urgencia`, `responsable`, `estado_salud`
- Para clientes Copilot: acceso a operación completa (carga snapshots, gestión alertas/tareas)
- Para clientes 360°: acceso a monitoreo y soporte únicamente
- Trazabilidad: historial de acciones via `task_events`

### Vista 2 — Gerencial del Cliente
- **Ruta base:** `/brand/`
- **Roles con acceso:** `client_manager`
- **Propósito:** entender el estado del negocio en < 30 segundos. No es consola operativa.
- **Criterio de éxito:** el decisor entiende la situación sin que nadie se la explique

**Contenido MVP:**
- Score global con estado cualitativo en lenguaje simple
- Facturación/ventas + tendencia vs período anterior
- Rentabilidad estimada
- ROAS/ACOS/TACOS en lenguaje de negocio (no técnico)
- 3–5 alertas estratégicas con `audience = 'manager'`
- Gráfico de evolución del score (últimos 6 meses)

**⚠️ Regla de lenguaje obligatoria para esta vista:**
```
❌ NUNCA: "En desarrollo", "ACOS 15%", "TACOS 66%"
✅ SIEMPRE: "Tu cuenta está mejorando", "Tu publicidad genera $X por cada $1 invertido"
```

### Vista 3 — Operativa del Cliente
- **Ruta base:** `/ops/`
- **Roles con acceso:** `client_operator` (plan 360°) o `internal_operator_meli_growth` (plan Copilot)
- **Propósito:** saber exactamente qué hacer hoy
- **Criterio de éxito:** el operador entra y sabe qué hacer sin interpretación externa

**Contenido MVP:**
- Top 5 prioridades del día (generadas por el motor de alertas)
- Alertas operativas ordenadas por impacto con `audience = 'operator'`
- Scoring por bloque con semáforo visual
- Listado de tareas pendientes con estado
- Acciones sugeridas con benchmark y objetivo

**Bloques prioritarios para MVP:** Ads, conversión, stock, pricing.

---

## 4. ROLES Y PERMISOS

```typescript
type UserRole = 
  | 'super_admin_meli_growth'       // Luciano — ve todo
  | 'internal_operator_meli_growth' // Andrea, Joaquín, Nacho, Dai — ve cuentas asignadas
  | 'client_manager'                // Dueño/decisor del cliente — solo su company
  | 'client_operator'               // Operador del cliente — solo su ml_account (plan 360°)
```

### Matriz de acceso por rol

| Rol | `/internal/**` | `/brand/**` | `/ops/**` | Ve otras companies | Ve otras accounts |
|---|---|---|---|---|---|
| `super_admin_meli_growth` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `internal_operator_meli_growth` | ✅ solo asignadas | ❌ | ✅ solo asignadas | ❌ | ❌ |
| `client_manager` | ❌ | ✅ solo su company | ❌ | ❌ | ❌ |
| `client_operator` | ❌ | ❌ | ✅ solo su account | ❌ | ❌ |

### Implementación de permisos
> ⛔ **Los permisos NO se resuelven duplicando usuarios.** Se resuelven con `user_account_access`.  
> Una persona puede tener múltiples accesos con distintos `access_type` sobre distintas cuentas.

```sql
-- user_account_access define QUÉ puede hacer un usuario sobre QUÉ cuenta
access_type: 'manager' | 'operator' | 'internal'
```

---

## 5. SISTEMA DE SCORING — MOTOR CENTRAL

> ⛔ **Todo el scoring vive en el módulo `lib/scoring/`** (barrel `lib/scoring/index.ts`; núcleo en `block-calculations.ts`, semántica snapshot en `metric-semantics.ts` / `metric-snapshot.ts`). **NUNCA duplicar esta lógica.**  
> ⛔ **El frontend NUNCA recalcula. Solo consume `account_health`.**  
> En snapshots, **`null` (ausencia) ≠ `0` (valor numérico)** — ver `docs/estado-actual-ops.md` §8.2.

### Bloques y pesos exactos

```typescript
const BLOCK_WEIGHTS = {
  salud:       0.35, // CRÍTICO — afecta reputación ML directamente
  publicaciones: 0.20,
  ads:         0.20,
  logistica:   0.15,
  stock:       0.10,
} as const
// INVARIANTE: sum(BLOCK_WEIGHTS) === 1.00
```

### Escala de estados

```typescript
type AccountStatus = 'platinum' | 'muy_bueno' | 'solido' | 'en_desarrollo' | 'en_riesgo' | 'critico'

const STATUS_RANGES: Record<AccountStatus, { min: number; max: number; accion: string }> = {
  platinum:      { min: 95,  max: 100, accion: "Escalar con control. Aumentar inversión en top productos." },
  muy_bueno:     { min: 85,  max: 94,  accion: "Escalar con monitoreo. Cerrar últimas brechas. Escalar ads en top campañas con margen." },
  solido:        { min: 70,  max: 84,  accion: "Optimizar antes de escalar. No escalar ads hasta cerrar brechas." },
  en_desarrollo: { min: 55,  max: 69,  accion: "Corregir brechas clave. Frenar ads. Corregir publicaciones primero." },
  en_riesgo:     { min: 40,  max: 54,  accion: "Acción correctiva urgente. Atacar los 2 bloques con menor score." },
  critico:       { min: 0,   max: 39,  accion: "Plan de rescate. Pausar toda inversión en ads." },
}
```

### Benchmarks por bloque

> Todos los benchmarks viven en `lib/recommendations/benchmarks.ts`. **NUNCA hardcodear en la UI.**

#### Bloque 01 — Salud (peso 35%)
Pesos internos: Reclamos 30% · Mediaciones 25% · Cancelaciones vendedor 25% · Envíos a tiempo 20%

| Métrica | Score 100 | Score 85 | Score 70 | Score 55 | Score 15 |
|---|---|---|---|---|---|
| Reclamos % | < 0.2% | < 0.5% | 0.5–1.0% | 1.0–1.5% | > 1.5% |
| Mediaciones % | < 0.05% | < 0.2% | 0.2–0.4% | 0.4–0.5% | > 0.5% |
| Cancelaciones vendedor % | < 0.05% | < 0.2% | 0.2–0.4% | 0.4–0.5% | > 0.5% |
| Envíos a tiempo % | > 98.5% | > 95% | 92–95% | 88–92% | < 88% |

**Cap inteligente del bloque Salud:**
```typescript
// Si cualquier métrica individual tiene score < 40 → cap del bloque = 55
// Si cualquier métrica individual tiene score 40–54 → cap del bloque = 72
// Este cap preserva la señal de urgencia sin colapsar el diagnóstico completo
function applySaludCap(rawScore: number, minMetricScore: number): number {
  if (minMetricScore < 40) return Math.min(rawScore, 55)
  if (minMetricScore < 55) return Math.min(rawScore, 72)
  return rawScore
}
```

#### Bloque 02 — Publicaciones (peso 20%)

| Métrica | Score 100 | Score 85 | Score 70 | Score 55 | Score 15 | Zona |
|---|---|---|---|---|---|---|
| % publicaciones activas | > 85% | > 65% | 40–65% | 25–40% | < 25% | A (obligatorio) |
| % publicaciones optimizadas | > 85% | > 60% | 40–60% | 20–40% | < 20% | B (opcional ★) |
| CTR publicaciones | > 3.5% | > 1.5% | 1.0–1.5% | 0.7–1.0% | < 0.7% | B (opcional ★) |

★ Zona B = opcional. Si el campo está vacío → no penaliza, se excluye del cálculo del bloque.

#### Bloque 03 — Ads (peso 20%) — LÓGICA ESPECIAL

**Inputs que ingresa el operador (los únicos 4 datos):**
```typescript
interface AdsInput {
  margen_pre_ads: number   // porcentaje, e.g. 30
  gasto_ads: number        // pesos $
  ventas_ads: number       // pesos $
  ventas_totales: number   // pesos $
}
```

**Cálculos automáticos (NUNCA ingresar manualmente — siempre derivados):**
```typescript
const acos  = (gasto_ads / ventas_ads) * 100
const roas  = ventas_ads / gasto_ads
const tacos = (gasto_ads / ventas_totales) * 100
const roas_breakeven = 1 / (margen_pre_ads / 100)
```

| Métrica | Score 100 | Score 85 | Score 70 | Score 55 | Score 15 |
|---|---|---|---|---|---|
| ACOS % | < 6% | 8–12% | 12–15% | 15–20% | > 20% |
| ROAS | > 8x | 4–6x | 3–4x | 1.5–3x | < 1.5x |
| % ventas por ads | 20–25% (sweet spot) | 10–35% | 5–40% | 1–5% | < 1% |

**Diagnóstico TACOS vs margen (semáforo independiente del score):**
```typescript
function evaluateTacos(tacos: number, margen_pre_ads: number): 'escalable' | 'optimizar' | 'critico' {
  const ratio = tacos / margen_pre_ads
  if (ratio < 0.13) return 'escalable'   // TACOS < 13% del margen → podés escalar agresivo
  if (ratio < 0.65) return 'optimizar'   // TACOS 13–65% del margen → aceptable, optimizar antes
  return 'critico'                        // TACOS > 65% del margen → PERDÉS PLATA GLOBALMENTE
}
```

#### Bloque 04 — Logística (peso 15%)

| Métrica | Score 100 | Score 85 | Score 70 | Score 55 | Score 15 |
|---|---|---|---|---|---|
| % incidencias | < 0.3% | < 1.5% | 1.5–2.5% | 2.5–4% | > 4% |
| Uso Full/Flex % | > 80% | > 50% | 30–50% | 15–30% | < 15% |
| Cancelaciones por stock % | < 0.2% | < 0.8% | 0.8–1.5% | 1.5–3% | > 3% |

#### Bloque 05 — Stock (peso 10%)

| Métrica | Score 100 | Score 85 | Score 70 | Score 55 | Score 15 | Zona |
|---|---|---|---|---|---|---|
| % SKUs sin stock | < 1% | < 5% | 5–8% | 8–15% | > 15% | A (obligatorio) |
| Días de stock | 20–35d | 10–60d | 7–75d | 5–90d | < 5d | B (opcional ★) |
| Lead time reposición | < 3d | < 10d | 10–15d | 15–25d | > 25d | B (opcional ★) |

★ Zona B = datos internos del cliente, no disponibles en API de ML. Siempre manuales.

### Fórmula del score global

```typescript
function calculateGlobalScore(blocks: BlockScores): number {
  // Si Ads no tiene datos de entrada → se excluye y los pesos se redistribuyen proporcionalmente
  const hasAds = blocks.ads !== null

  const weights = hasAds
    ? { salud: 0.35, publicaciones: 0.20, ads: 0.20, logistica: 0.15, stock: 0.10 }
    : { salud: 0.4375, publicaciones: 0.25, ads: 0, logistica: 0.1875, stock: 0.125 }
    // redistribuidos: cada peso_original / (1 - 0.20)

  const raw =
    (blocks.salud * weights.salud) +
    (blocks.publicaciones * weights.publicaciones) +
    ((blocks.ads ?? 0) * weights.ads) +
    (blocks.logistica * weights.logistica) +
    (blocks.stock * weights.stock)

  return Math.max(0, Math.min(100, raw)) // INVARIANTE: resultado siempre en [0, 100]
}
```

**Nota:** el pseudocódigo resume pesos y redistribución; la implementación ejecutable y la semántica `null`/`0` en métricas obligatorias vs opcionales están en `lib/scoring/` (`block-calculations`, `metric-semantics`, `metric-snapshot`). Si diverge de esta sección, prevalece el código.

---

## 6. CALCULADORA DE PRECIOS ML

> Herramienta para que Andrea arme propuestas comerciales. Vive en la vista interna.

### Fórmula

```typescript
// lib/pricing/calculator.ts
function calcularPrecioVenta(input: PricingInput): PricingResult {
  const { costo, envioFijo, costoFijo, comisionML, publicidad, margen } = input
  const precio = (costo + envioFijo + costoFijo) / (1 - comisionML - publicidad - margen)
  const ganancia = precio * margen
  const roi = (ganancia / costo) * 100
  return { precio, ganancia, roi }
}
```

### Constantes — `lib/config/constants.ts` (NUNCA hardcodeadas en otro lugar)

```typescript
export const ML_CONFIG = {
  comision_pct: 0.1375, // 13.75% — promedio oficial Argentina 2026

  envio: {
    full_pct: 0.10,          // 10% del precio de venta
    flex_pct: 0.07,          // 7% del precio de venta + costoFijo si precio < $33.000
    retiro_domicilio_pct: 0, // Sin costo
  },

  costos_fijos_flex: [       // Aplica solo si precio < $33.000
    { hasta: 15999,  costo: 1255 },
    { hasta: 23999,  costo: 2500 },
    { hasta: 33000,  costo: 3030 },
    { hasta: Infinity, costo: 0 },
  ],

  costos_fijos_full: [       // Aplica solo si precio < $33.000
    { hasta: 15000,  costo: 1095 },
    { hasta: 25000,  costo: 2190 },
    { hasta: 33000,  costo: 2628 },
    { hasta: Infinity, costo: 0 },
  ],
}
```

### Casos de prueba verificados (planilla V4 del Drive)

```typescript
// Usar estos valores para validar la implementación:
// Flex + costo $15.600 + ads 10% + margen 15% → precio $30.416, ganancia $4.562, ROI 29.2%
// Retiro + costo $15.600 + ads 10% + margen 15% → precio $25.469, ganancia $3.820, ROI 24.5%
// Full + costo $15.600 + ads 20% + margen 20% → precio $46.270, ganancia $9.254, ROI 59.3%
// Flex + costo $345.555 + ads 25% + margen 15% → precio $747.146
```

---

## 7. PIPELINE DE DATOS

```
[1] EXTRACCIÓN     lib/ml/pipeline.ts — orquesta los 5 bloques
[2] NORMALIZACIÓN  → metric_snapshots (foto diaria, datos crudos)
[3] PERSISTENCIA   → account_health (resultado del scoring, separado para poder recalcular)
[4] SCORING        lib/scoring/ — NUNCA en el frontend
[5] ALERTAS        lib/recommendations/engine.ts → alerts + tasks
[6] VISUALIZACIÓN  Las 3 vistas consumen datos ya procesados
```

### Reglas de extracción

```typescript
// Prioridad de fuentes por bloque:
// API oficial ML > scraping controlado > carga manual/CSV

// Si un bloque de la API falla → el campo queda null, el formulario sigue funcionando
// Fallback es graceful. NUNCA bloquear el flujo completo por un bloque fallido.

// Cada corrida se registra en ingestion_runs con:
interface IngestionRun {
  ml_account_id: string
  status: 'success' | 'partial' | 'failed'
  data_sources: Record<BlockName, 'api' | 'scraper' | 'manual' | 'unavailable'>
  error_detail?: string
  created_at: Date
}
```

### Campos que NUNCA estarán disponibles en la API de ML (siempre manuales)

```typescript
// Estos campos se cargan via formulario o planilla — nunca intentar obtenerlos de la API:
const MANUAL_ONLY_FIELDS = [
  'ctr_publicaciones',          // No expuesto por la API
  'dias_stock',                 // Dato interno: stock_fisico / (ventas_30d / 30)
  'lead_time_reposicion',       // Dato del proveedor del cliente
  'sistema_reposicion',         // Evaluación cualitativa 1-4 del cliente
] as const
```

---

## 8. MODELO DE DATOS

### Schema nuevo (migración 0004) — convive con schema anterior (0001-0003)

```sql
-- Entidad raíz: la empresa cliente
companies (
  id              uuid PRIMARY KEY,
  name            text NOT NULL,
  plan_type       text CHECK (plan_type IN ('360', '360_copilot')),
  status          text CHECK (status IN ('active', 'paused', 'churned')),
  created_at      timestamptz DEFAULT now()
)

-- ENTIDAD CENTRAL del sistema: la cuenta de Mercado Libre
ml_accounts (
  id              uuid PRIMARY KEY,
  company_id      uuid REFERENCES companies(id),
  ml_seller_id    text,                        -- ID numérico del vendedor en ML
  nickname        text,
  site_id         text DEFAULT 'MLA',          -- Argentina
  responsible_id  uuid REFERENCES users_v2(id),-- operador interno asignado
  created_at      timestamptz DEFAULT now()
)

-- Usuarios del sistema
users_v2 (
  id              uuid PRIMARY KEY,
  email           text UNIQUE NOT NULL,
  name            text,
  role            text CHECK (role IN (
    'super_admin_meli_growth',
    'internal_operator_meli_growth',
    'client_manager',
    'client_operator'
  )),
  created_at      timestamptz DEFAULT now()
)

-- Permisos flexibles por cuenta — resuelve multi-rol y multi-cuenta
user_account_access (
  id              uuid PRIMARY KEY,
  user_id         uuid REFERENCES users_v2(id),
  ml_account_id   uuid REFERENCES ml_accounts(id),
  access_type     text CHECK (access_type IN ('manager', 'operator', 'internal')),
  UNIQUE(user_id, ml_account_id, access_type)
)

-- Foto diaria de métricas normalizadas (datos crudos — no se modifican)
metric_snapshots (
  id              uuid PRIMARY KEY,
  ml_account_id   uuid REFERENCES ml_accounts(id),
  snapshot_date   date NOT NULL,
  -- Bloque 01 Salud
  reclamos_pct            numeric,
  mediaciones_pct         numeric,
  cancelaciones_vendedor_pct numeric,
  envios_a_tiempo_pct     numeric,
  -- Bloque 02 Publicaciones
  pubs_activas_pct        numeric,
  pubs_optimizadas_pct    numeric,  -- Zona B
  ctr_pubs_pct            numeric,  -- Zona B — manual siempre
  -- Bloque 03 Ads (solo inputs — los cálculos van en account_health)
  margen_pre_ads_pct      numeric,
  gasto_ads               numeric,
  ventas_ads              numeric,
  ventas_totales          numeric,
  -- Bloque 04 Logística
  incidencias_pct         numeric,
  uso_full_flex_pct       numeric,
  cancelaciones_stock_pct numeric,
  -- Bloque 05 Stock
  skus_sin_stock_pct      numeric,
  dias_stock              numeric,  -- Zona B — manual
  lead_time_reposicion    numeric,  -- Zona B — manual
  -- Trazabilidad de origen
  data_sources            jsonb,    -- { salud: 'api', ads: 'manual', stock: 'unavailable', ... }
  ingestion_run_id        uuid REFERENCES ingestion_runs(id),
  created_at              timestamptz DEFAULT now(),
  UNIQUE(ml_account_id, snapshot_date)
)

-- Resultado del scoring — SEPARADO de snapshots para poder recalcular si cambian las reglas
account_health (
  id              uuid PRIMARY KEY,
  ml_account_id   uuid REFERENCES ml_accounts(id),
  snapshot_id     uuid REFERENCES metric_snapshots(id),
  score_global    numeric CHECK (score_global BETWEEN 0 AND 100),
  status          text,  -- ver STATUS_RANGES
  score_salud     numeric,
  score_publicaciones numeric,
  score_ads       numeric,
  score_logistica numeric,
  score_stock     numeric,
  -- Ads derivados (calculados, no ingresados)
  acos            numeric,
  roas            numeric,
  tacos           numeric,
  roas_breakeven  numeric,
  calculated_at   timestamptz DEFAULT now()
)

-- Señales accionables segmentadas por audiencia
alerts (
  id              uuid PRIMARY KEY,
  ml_account_id   uuid REFERENCES ml_accounts(id),
  account_health_id uuid REFERENCES account_health(id),
  priority        text CHECK (priority IN ('urgente', 'alta', 'media', 'baja')),
  audience        text CHECK (audience IN ('internal', 'manager', 'operator', 'all')),
  block           text,  -- 'salud' | 'publicaciones' | 'ads' | 'logistica' | 'stock' | null
  title           text NOT NULL,
  description     text,
  is_resolved     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
)

-- Acciones operativas con responsable y estado
tasks (
  id              uuid PRIMARY KEY,
  alert_id        uuid REFERENCES alerts(id),
  ml_account_id   uuid REFERENCES ml_accounts(id),
  assigned_to     uuid REFERENCES users_v2(id),
  status          text CHECK (status IN ('pendiente', 'en_curso', 'completada', 'descartada')),
  title           text NOT NULL,
  description     text,
  due_date        date,
  created_at      timestamptz DEFAULT now()
)

-- Trazabilidad completa de cada cambio en tarea
task_events (
  id              uuid PRIMARY KEY,
  task_id         uuid REFERENCES tasks(id),
  user_id         uuid REFERENCES users_v2(id),
  event_type      text,  -- 'created' | 'status_changed' | 'reassigned' | 'commented'
  previous_value  text,
  new_value       text,
  created_at      timestamptz DEFAULT now()
)

-- Registro de cada corrida de ingestión
ingestion_runs (
  id              uuid PRIMARY KEY,
  ml_account_id   uuid REFERENCES ml_accounts(id),
  status          text CHECK (status IN ('success', 'partial', 'failed')),
  data_sources    jsonb,
  error_detail    text,
  created_at      timestamptz DEFAULT now()
)
```

### Schema anterior (0001-0003) — no modificar, coexiste durante la transición
```
users, clients, diagnostics, score_history, actions, notifications, pricing_proposals, meli_sessions
```

### Relaciones clave (para navegación del agente)

```
company (1) ──── (N) ml_accounts
ml_account (1) ──── (N) metric_snapshots
ml_account (1) ──── (N) user_account_access
metric_snapshot (1) ──── (1) account_health
account_health (1) ──── (N) alerts
alert (1) ──── (N) tasks
task (1) ──── (N) task_events
```

---

## 9. RUTAS DEL SISTEMA

```typescript
// Rutas internas — equipo Meli Growth
'/internal/dashboard'                          // Cartera con filtros
'/internal/clients'                            // Lista de companies
'/internal/clients/new'                        // Alta nueva company + ml_account
'/internal/clients/[id]'                       // Vista completa: score + alertas + tareas
'/internal/clients/[id]/diagnostic/new'        // Carga diagnóstico (solo equipo MG)
'/internal/clients/[id]/settings'             // Conectar OAuth de ML

// Rutas gerenciales — decisor del cliente
'/brand/dashboard'                             // Estado ejecutivo
'/brand/metrics'                               // Evolución histórica (6 meses)
'/brand/notifications'                         // Alertas estratégicas

// Rutas operativas — operador
'/ops/dashboard'                               // Top 5 prioridades del día
'/ops/alerts'                                  // Alertas operativas por impacto
'/ops/tasks'                                   // Lista tareas con estado
'/ops/listings'                                // Publicaciones críticas (bloque 02)
'/ops/stock'                                   // Estado de stock (bloque 05)
'/ops/ads'                                     // Performance de ads (bloque 03)

// Rutas de sistema
'/login'                                       // Entrada única → redirige según rol
'/'                                            // Redirige según user_role_v2
'/api/ml/auth/callback'                        // Callback OAuth de ML
```

### Middleware de protección — `middleware.ts`

```typescript
// ÚNICA fuente de verdad para control de acceso por ruta
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/internal/**': ['super_admin_meli_growth', 'internal_operator_meli_growth'],
  '/brand/**':    ['client_manager'],
  '/ops/**':      ['client_operator'],
}
// ⛔ NUNCA implementar permisos de ruta fuera de middleware.ts
```

---

## 10. ALERTAS — ESPECIFICACIÓN

```typescript
interface Alert {
  priority: 'urgente' | 'alta' | 'media' | 'baja'
  audience: 'internal' | 'manager' | 'operator' | 'all'
  block?: 'salud' | 'publicaciones' | 'ads' | 'logistica' | 'stock'
  title: string         // < 80 caracteres, lenguaje adaptado a la audiencia
  description?: string  // Detalle accionable
}
```

**Ejemplos por audiencia (obligatorios como referencia de tono):**

```
// audience: 'manager' — lenguaje ejecutivo, sin jerga técnica
"Tu cuenta perdió 8 puntos este mes — hay 2 áreas críticas"
"La inversión en publicidad está destruyendo margen"
"35% de tu catálogo está sin stock — ventas perdidas"

// audience: 'operator' — accionables inmediatamente
"Envíos a tiempo al 90% — penalización activa posible. Revisar SLA con logística."
"3 SKUs de alto volumen sin stock hace más de 5 días"
"ACOS al 200% en campaña principal — pausar hasta revisar"

// audience: 'internal' — monitoreo y escalado
"Cuenta en estado crítico sin intervención hace 7 días"
"Cliente Copilot: vence diagnóstico quincenal en 2 días"
```

> Los textos de alertas los genera `lib/recommendations/engine.ts`, basado en benchmarks de `lib/recommendations/benchmarks.ts`.

---

## 11. INTEGRACIÓN CON API DE MERCADO LIBRE

### Endpoints por bloque

```typescript
const ML_API_ENDPOINTS = {
  salud:         '/users/{seller_id}/seller_reputation',
  publicaciones: '/users/{seller_id}/items/search',        // + /item/{id}/performance
  ads:           '/advertising/advertisers/{id}/product_ads/reports',
  logistica:     '/orders/search',                          // + items con logistic_type=fulfillment
  stock:         '/items/{id}?attributes=available_quantity', // + fulfillment stock API
}
```

### Flujo OAuth

```
1. Operador → /internal/clients/[id]/settings → "Conectar cuenta ML"
2. App redirige al OAuth de ML (URL de autorización con ML_CLIENT_ID)
3. Seller autoriza en ML
4. ML redirige a /api/ml/auth/callback con ?code=...
5. App intercambia code → access_token + refresh_token
6. Tokens se guardan en Supabase Storage (bucket: 'meli-sessions')
   ⛔ NUNCA guardar tokens en columnas de DB en texto plano
7. ml_accounts.meli_session_status → 'validated'
```

### Variables de entorno requeridas

```bash
ML_CLIENT_ID        # App ID registrada en ML Developers
ML_CLIENT_SECRET    # Secret de la app
ML_REDIRECT_URI     # https://dominio.vercel.app/api/ml/auth/callback
```

### Rate limits

```typescript
// Apps no certificadas: 3.000 req/día
// Apps certificadas:    30.000 req/día
// Error 429 → respetar el header Retry-After
```

---

## 12. ONBOARDING DE CLIENTES — 3 PLANILLAS OBLIGATORIAS

> Sin estas planillas completas, no se arranca la operación con un cliente nuevo.

| Planilla | Columnas clave | Nota crítica |
|---|---|---|
| **1 — SKUs, Stock y Precio Mínimo** | SKU · Nombre · Stock actual · Stock en tránsito · Precio mínimo $ · Precio sugerido $ · Envío Full S/N | Precio mínimo = piso de repricing. Nunca vender por debajo. |
| **2 — Márgenes y Costos** | SKU · Costo unitario $ · Comisión ML % · Costo envío $ · Margen mínimo % | Si el costo cambia → avisar antes de actualizar. Un costo viejo rompe la estrategia de pricing. |
| **3 — Ficha Técnica de Productos** | SKU · Nombre para publicar · Marca · Modelo · Descripción · Atributos técnicos · Fotos listas S/N · Garantía meses | — |

---

## 13. EQUIPO INTERNO MELI GROWTH

| Persona | Rol en app | Responsabilidades en la app |
|---|---|---|
| Luciano | `super_admin_meli_growth` | Toda la cartera, aprueba accesos, monitoreo del negocio |
| Andrea | `internal_operator_meli_growth` | Calculadora de pricing, onboarding de clientes |
| Joaquín | `internal_operator_meli_growth` | Carga diagnósticos, genera alertas, reportes quincenales |
| Nacho | `internal_operator_meli_growth` | Opera cuentas Copilot, gestiona alertas y tareas operativas |
| Dai | `internal_operator_meli_growth` | Monitorea ACOS/ROAS/TACOS, gestiona campañas en cuentas Copilot |

---

## 14. COMPETIDORES Y DIFERENCIAL

| Competidor | Qué resuelve | Diferencial Meli Growth |
|---|---|---|
| NonChatBot | Mensajería automática pre/post venta | MG automatizaría con contexto de salud y rentabilidad de la cuenta |
| Foxie | Repricing y visibilidad por precio | MG haría repricing con criterio económico integrado (margen + conversión + competitividad) |

**Diferencial central:** MG no automatiza acciones aisladas, sino decisiones respaldadas por contexto integral. No baja un precio "porque sí" — lo hace cuando el impacto sobre margen, conversión y competitividad es coherente con la estrategia de esa cuenta específica.

---

## 15. ROADMAP 90 DÍAS — ESTADO ACTUAL

```
✅ Días 1–15:  Fundación técnica — roles, cuentas, permisos, navegación base  ← ESTAMOS ACÁ
🔲 Días 16–30: Motor MVP — persistencia snapshots, health, alertas, tareas
🔲 Días 31–45: Vistas base — internal, brand, ops con info mínima útil
🔲 Días 46–60: Datos reales — API ML, scraping controlado, fallback manual
🔲 Días 61–75: Piloto — prueba con primeros clientes reales
🔲 Días 76–90: Consolidación — mejora UX, limpieza técnica, próximo tramo
```

### Qué NO entra en el MVP (no construir todavía)
```
❌ Repricing automático
❌ Mensajería automática pre y post venta
❌ IA conversacional
❌ Deep analytics / reportes históricos complejos
❌ Automatizaciones de cualquier tipo
```

---

## 16. REGLAS TÉCNICAS — CHECKLIST PARA EL AGENTE

### Reglas de negocio (nunca violar)

```
✅ Los 2 planes son el mismo sistema con distintos permisos. NUNCA dos apps separadas.
✅ Un client_manager NUNCA ve datos de otra company.
✅ Un client_operator NUNCA ve datos de otra ml_account.
✅ Un internal_operator ve solo las cuentas que tiene asignadas.
✅ Un super_admin es el único que ve todo sin restricciones.
✅ La vista NUNCA recalcula scoring — solo consume account_health.
✅ Los benchmarks viven en lib/recommendations/benchmarks.ts — NUNCA en la UI.
✅ Las constantes del negocio viven en lib/config/constants.ts — NUNCA dispersas.
✅ Los tokens de ML van en Supabase Storage — NUNCA en columnas de DB en texto plano.
```

### Reglas de arquitectura (nunca violar)

```
✅ No duplicar lógica de scoring entre frontend y backend.
✅ No acoplar permisos a rutas sin pasar por middleware.ts.
✅ No hardcodear datos en la vista.
✅ No asumir que hay un solo ml_account por company (el modelo soporta múltiples).
✅ No usar el service role de Supabase en actions de usuario.
   → Service role: solo en cron jobs y /api/internal/.
✅ Trackear siempre data_sources en cada snapshot.
✅ Si un bloque de la API de ML falla → el formulario sigue con ese campo en null.
```

### Árbol de decisión para ubicar lógica nueva

```
¿Es lógica de negocio?
  ├─ Sí → ¿Es scoring?         → lib/scoring/
  │        ¿Es pricing?         → lib/pricing/calculator.ts
  │        ¿Son alertas?        → lib/recommendations/engine.ts
  │        ¿Son benchmarks?     → lib/recommendations/benchmarks.ts
  │        ¿Son constantes?     → lib/config/constants.ts
  │        ¿Es integración ML?  → lib/ml/
  └─ No → ¿Es renderizado?     → components/
          ¿Es protección ruta?  → middleware.ts
          ¿Es tipo/interfaz?    → types/
```

---

## 17. DATOS DE PRUEBA — GROUND TRUTH PARA TESTS

> Estos datos son ficticios, basados en planillas v22/v23 del Drive. Son el fixture canónico para todos los tests del motor de scoring.

```typescript
// Caso: score 63 — estado "En riesgo" con Ads CRÍTICO
export const FIXTURE_DIAGNOSTICO_ESTANDAR = {
  // Bloque 01 Salud → score_salud: 67
  reclamos_pct:                0.6,   // En desarrollo (bench sólido: < 0.5%)
  mediaciones_pct:             0.2,   // En desarrollo (bench sólido: < 0.2%)
  cancelaciones_vendedor_pct:  0.3,   // En desarrollo
  envios_a_tiempo_pct:         90,    // En riesgo (bench sólido: > 95%)
  score_salud: 67,

  // Bloque 02 Publicaciones → score_publicaciones: 81
  pubs_activas_pct:     64.4,   // En desarrollo
  pubs_optimizadas_pct: 70,     // Sólido (Zona B)
  ctr_pubs_pct:         2.1,    // Sólido (Zona B)
  score_publicaciones: 81,

  // Bloque 03 Ads → score_ads: 15 (CRÍTICO)
  margen_pre_ads_pct:  30,
  gasto_ads:           20000,
  ventas_ads:          10000,
  ventas_totales:      30000,
  // Derivados calculados:
  acos:   200,    // CRÍTICO — 200% supera margen
  roas:   0.5,    // CRÍTICO — por debajo del break-even de 3.33x
  tacos:  66.7,   // CRÍTICO — supera el margen del 30%
  score_ads: 15,

  // Bloque 04 Logística → score_logistica: 81
  incidencias_pct:          1.2,
  uso_full_flex_pct:        58,
  cancelaciones_stock_pct:  0.8,
  score_logistica: 81,

  // Bloque 05 Stock → score_stock: 82
  skus_sin_stock_pct:    3.6,
  dias_stock:            38,    // Zona B — Muy bueno (15–45d)
  lead_time_reposicion:  9,     // Zona B — Sólido
  score_stock: 82,

  // Score global esperado:
  // (67×0.35) + (81×0.20) + (15×0.20) + (81×0.15) + (82×0.10)
  // = 23.45 + 16.2 + 3 + 12.15 + 8.2 = 63 ✓
  score_global: 63,
  status: 'en_riesgo',
} as const
```

---

## 18. IDENTIFICADORES DEL PROYECTO

```
Repositorio:   github.com/growthmeli-tech/meligrowth-app
URL producción: mgrowth-app-growthmeli-tech-growthmeli-techs-projects.vercel.app
Site ML:       MLA (Argentina) — site_id = "MLA"
Contacto MG:   growthmeli@gmail.com
```