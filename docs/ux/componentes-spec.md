# Componentes UX Spec Premium (Meli Growth 360)

## Base visual obligatoria (aplica a todo)
- Fondo app: `bg-[#F5F5F0]`
- Card base: `bg-white rounded-xl shadow-sm border border-[#E8E8E2]`
- Hover card: `hover:shadow-md transition-shadow duration-200`
- CTA primario: `bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg`
- Tipografia:
  - display: `text-8xl font-black`
  - headers: `text-xl font-bold`
  - seccion: `text-xs font-bold uppercase tracking-widest text-[#6B6B6B]`
  - body: `text-sm font-medium`
  - metricas: `font-mono tabular-nums`

---

## 1) `ScoreDisplay`

### Layout exacto (LG)
```text
┌─────────────────────────────────────┐
│                                     │
│           [  77  ]                  │
│        Tu cuenta esta Solida        │
│      ↑ Subio 5 pts este mes         │
│      Actualizado: 24 abr 2026       │
│                                     │
└─────────────────────────────────────┘
```

### Variantes
- **LG**: `flex flex-col items-center justify-center gap-2 p-6 min-h-[280px]`
  - score: `text-8xl font-black leading-none font-mono tabular-nums`
  - estado: `text-lg font-medium`
  - delta: `text-sm font-semibold`
  - fecha: `text-xs text-[#6B6B6B]`
- **MD** (`[ 77 ] Solido ↑+5`): `flex items-center gap-2`
  - score: `text-4xl font-black font-mono tabular-nums w-[5ch]`
  - estado chip: `text-xs font-bold px-2 py-0.5 rounded-full border`
  - delta: `text-xs font-semibold`
- **SM** (`[77] ████████░░ Solido`): `flex items-center gap-2`
  - score: `text-2xl font-bold font-mono tabular-nums w-[3ch]`
  - barra: `w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden`
  - label: `text-xs font-medium`

### Semaforo (color score + estado)
- Platinum: `text-green-700 bg-green-50 border-green-200`
- Muy bueno: `text-green-600 bg-green-50 border-green-200`
- Solido: `text-blue-600 bg-blue-50 border-blue-200`
- En desarrollo: `text-amber-700 bg-amber-50 border-amber-200`
- En riesgo: `text-orange-600 bg-orange-50 border-orange-200`
- Critico: `text-red-600 bg-red-50 border-red-200`

### Estados
- default: card base + color semaforo.
- hover: `hover:shadow-md`.
- active: `ring-2 ring-[#FFD600] ring-offset-1`.
- loading: skeleton `w-20 h-20 rounded-full bg-gray-200 animate-pulse` + 2 lineas `h-4 w-40`.
- empty: copy `"Sin score aun"` + subtitulo `"Crea el primer diagnostico para ver estado"`.
- error: score reemplazado por `"--"` + copy `"No pudimos calcular el score"`.

### Breakpoints
- mobile: LG baja a `text-6xl` y `min-h-[220px]`.
- desktop (`md:`): LG mantiene `text-8xl`; MD se usa en cards y SM en tablas.

### Animacion
- count-up de 0 al valor final.
- duracion `800ms`, easing `ease-out`.
- delta aparece con fade `duration-200`.

### Jerarquia visual
- Dominante: numero score.
- Secundario: estado textual.
- Tercero: delta; fecha siempre secundaria gris.

---

## 2) `BlockScoresRow`

### Layout exacto
```text
┌──────┬──────┬──────┬──────┬──────┐
│  01  │  02  │  03  │  04  │  05  │
│  67  │  81  │  15  │  81  │  82  │
│  🟡  │  🔵  │  🔴  │  🔵  │  🔵  │
│Salud │ Pubs │ Ads  │ Log. │Stock │
└──────┴──────┴──────┴──────┴──────┘
```

### Clases exactas
- contenedor desktop: `flex items-center gap-2`
- chip: `w-16 h-16 rounded-lg border border-[#E8E8E2] bg-white flex flex-col items-center justify-center`
- numero bloque: `text-[10px] font-bold text-[#6B6B6B]`
- score: `text-sm font-black font-mono tabular-nums`
- label: `text-[10px] font-medium text-[#6B6B6B]`
- peor score: `ring-2 ring-offset-1 shadow-sm`
- hover chip: `hover:scale-105 transition-transform duration-150`

### Estados
- default: fila completa visible.
- hover: solo chip hovered escala y eleva sombra.
- active: chip seleccionado `ring-2 ring-[#FFD600]`.
- loading: 5 chips `w-16 h-16 bg-gray-200 animate-pulse rounded-lg`.
- empty: copy `"Sin bloques disponibles para esta cuenta"`.
- error: chip unico con copy `"Error cargando bloques"`.

### Breakpoints
- mobile: `overflow-x-auto` + chips `w-14 h-14`.
- desktop: fijo 5 en fila.

### Animacion
- entry fade+slide: `duration-200 ease-out`.
- hover scale: `150ms`.

### Copy
- bloque sin datos: label `Sin datos`.
- tooltip opcional: `"Click para ver detalle del bloque"`.

### Jerarquia visual
- Dominante: score por chip.
- Enfasis adicional: peor bloque con ring visible.

---

## 3) `CompanyCard`

### Layout exacto
```text
┌─────────────────────────────────────────────────────┐
│ ▌  EMPRESA ABC                   [360°]  [Copilot] │
│   Score 77 · Solido  ↑+5        [🔴 1 urgente]     │
│   Responsable: Nacho · Activa                       │
│                                    [Ver cuenta →]   │
└─────────────────────────────────────────────────────┘
```

### Clases exactas
- card: `relative bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4`
- plan 360: `border-l-4 border-l-blue-500`
- plan copilot: `border-l-4 border-l-[#FFD600]`
- nombre: `text-sm font-bold text-[#1A1A1A]`
- metadata: `text-xs text-[#6B6B6B]`
- CTA: `text-sm font-semibold text-[#1A1A1A] hover:underline`
- hover card: `hover:shadow-md hover:bg-gray-50/50 cursor-pointer transition-all duration-200`
- chip alerta urgente: `bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full`
- pulso urgente: `animate-pulse`

### Estados
- default: card con plan y score.
- hover: sombra media y fondo sutil.
- active: `ring-2 ring-[#FFD600]`.
- loading: `h-20 rounded-xl bg-gray-200 animate-pulse`.
- empty: copy `"No hay empresas en cartera"` + CTA `"Agregar empresa →"`.
- error: copy `"No pudimos cargar esta cuenta"` + boton `"Reintentar"`.

### Breakpoints
- mobile: layout vertical `gap-2`; CTA debajo.
- desktop: grid `grid-cols-[1fr_auto] items-center`.

### Animacion
- hover shadow `200ms`.
- chip urgente pulse continuo `1.6s`.

### Jerarquia visual
- Dominante: nombre + score inline.
- Secundario: alerta urgente.
- Terciario: responsable/estado.

---

## 4) `RecommendationCard`

### Variante operator (layout exacto)
```text
┌─────────────────────────────────────────────────────┐
│▌ 🔴 URGENTE                              03 Ads     │
│                                                     │
│  ACOS al 200% — pausar campanas ahora              │
│  ROAS 0.5x (necesitas minimo 3.33x para no perder) │
│                                                     │
│  QUE HACER:                                         │
│  → Entrar a Mercado Ads y pausar campanas activas  │
│  → No reiniciar hasta revisar estructura de costos │
│                                                     │
│  Objetivo: ROAS >3.33x · Impacto: +5 pts globales  │
│                                                     │
│  [Crear tarea]              [Marcar vista ✓]       │
└─────────────────────────────────────────────────────┘
```

### Variante manager (layout exacto)
```text
┌─────────────────────────────────────────────────────┐
│▌ 🔴 URGENTE                          Publicidad     │
│                                                     │
│  Tu publicidad esta generando perdidas             │
│  Por cada $1 invertido en ads, generas $0.50       │
│                                                     │
│  Si no se corrige esta semana, el impacto en       │
│  rentabilidad puede ser significativo               │
│                                                     │
│  Impacto estimado si se resuelve: +15 pts          │
│                                                     │
│  [Solicitar accion al equipo operativo →]          │
└─────────────────────────────────────────────────────┘
```

### Clases exactas
- card base: `bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4`
- prioridad border:
  - urgente: `border-l-4 border-l-red-500`
  - alta: `border-l-4 border-l-orange-400`
  - media: `border-l-4 border-l-amber-300`
  - baja: `border-l-4 border-l-blue-300`
- titulo: `text-sm font-semibold text-[#1A1A1A]`
- contexto: `text-sm text-[#6B6B6B]`
- seccion "QUE HACER": `text-xs font-bold uppercase tracking-widest text-[#6B6B6B]`
- CTA primario operator: `bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2`
- CTA secundario operator: `text-gray-500 hover:text-[#1A1A1A] text-sm font-medium`
- CTA manager: mismo primario, ancho fit.

### Estados
- default: card completa.
- hover: `hover:shadow-md transition-shadow duration-200`.
- active: `ring-2 ring-[#FFD600]`.
- loading: skeleton `h-32 rounded-xl bg-gray-200 animate-pulse`.
- empty: copy `"No hay recomendaciones activas"` + CTA `"Crear accion preventiva"`.
- error: copy `"No se pudieron cargar recomendaciones"` + CTA `"Reintentar"`.

### Breakpoints
- mobile: CTAs en columna `flex-col gap-2`; texto max 2 lineas truncadas.
- desktop: CTAs a extremos `justify-between`.

### Animacion
- entrada stagger entre cards: `duration-180 ease-out`.
- hover shadow `200ms`.

### Copy obligatorio
- manager: nunca mostrar ACOS/ROAS/TACOS.
- operator: usar copy operativo directo.

### Jerarquia visual
- Dominante: titulo-problema.
- Secundario: accion concreta.
- Tercero: impacto estimado.

---

## 5) `AlertBanner`

### Layout exacto
```text
┌─────────────────────────────────────────────────────┐
│ 🔴  2 alertas urgentes requieren accion hoy        │
│     Empresa X: ads destruyendo margen              │
│     Empresa Y: salud critica — riesgo de baja      │
│                                    [Ver todas →]   │
└─────────────────────────────────────────────────────┘
```

### Clases exactas
- urgente: `bg-red-600 text-white rounded-xl p-4`
- alta: `bg-orange-500 text-white rounded-xl p-4`
- punto pulso: `inline-block w-2 h-2 rounded-full bg-white animate-pulse`
- CTA: `text-white font-semibold underline-offset-2 hover:underline`
- dismiss: `absolute top-3 right-3 text-white/80 hover:text-white`

### Estados
- default: visible solo con alertas urgentes/altas.
- hover: CTA subrayado.
- active: foco teclado en CTA `ring-2 ring-white/70`.
- loading: `h-20 rounded-xl bg-gray-200 animate-pulse`.
- empty: no render (retorna `null`).
- error: fallback `bg-red-50 text-red-700 border border-red-200`.

### Breakpoints
- mobile: copy en 2 lineas max, CTA abajo.
- desktop: CTA alineado derecha.

### Animacion
- entrada con slide-down `duration-200 ease-out`.
- pulso punto continuo `1.6s`.

### Copy
- urgente: `"X alertas urgentes requieren accion hoy"`.
- alta: `"X alertas altas para revisar hoy"`.

### Jerarquia visual
- Dominante: contador de urgencia en primera linea.
- Secundario: lista top alertas.

---

## 6) `DiagnosticFieldBenchmark`

### Layout exacto
```text
Reclamos %                                    🟢 API
┌────────────────────────────────────────────────┐
│  0.6                                      %    │
└────────────────────────────────────────────────┘
🟡 En desarrollo
Benchmark: <0.2% perfecto · <0.5% solido · >1% critico
Objetivo: llevar a <0.5%
```

### Clases exactas
- wrapper: `space-y-2`
- header: `flex items-center justify-between`
- label: `text-sm font-semibold text-[#1A1A1A]`
- badge api: `text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200`
- badge manual: `text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200`
- input: `w-full h-11 rounded-lg border border-[#E8E8E2] bg-white px-3 text-sm font-mono tabular-nums text-[#1A1A1A]`
- focus input: `focus:border-2 focus:border-[#FFD600] focus:outline-none`
- validacion error: `border-red-500 text-red-700`
- texto benchmark: `text-xs text-[#6B6B6B]`
- texto objetivo: `text-xs font-medium text-[#6B6B6B]`

### Estados
- default: input editable + benchmark.
- hover: input border `hover:border-gray-300`.
- active (focus): borde amarillo MG.
- loading: label + input `h-11 bg-gray-200 animate-pulse rounded-lg`.
- empty: valor vacio con hint `"Ingresa un valor para comparar con benchmark"`.
- error: borde rojo + copy `"Valor invalido. Ingresa un porcentaje entre 0 y 100."`.
- disabled: `opacity-50 cursor-not-allowed`.

### Breakpoints
- mobile: badge pasa debajo del label si no entra.
- desktop: label y badge siempre en misma linea.

### Animacion
- debounce de evaluacion: `300ms`.
- estado semaforo aparece con fade `duration-150`.

### Jerarquia visual
- Dominante: input.
- Secundario: estado semaforo.
- Tercero: benchmark y objetivo.

---

## 7) `PriorityList`

### Layout exacto
```text
HOY HACES ESTO
──────────────────────────────────────
🔴  1  Pausar ads                    [→]
ACOS al 200%. Perdes plata ahora.
──────────────────────────────────────
🟡  2  Revisar envios a tiempo       [→]
90% — riesgo de penalizacion.
──────────────────────────────────────
🟡  3  Reponer 3 SKUs sin stock      [→]
Sin stock hace 5 dias.
──────────────────────────────────────
```

### Clases exactas
- header: `text-xs font-bold uppercase tracking-widest text-[#6B6B6B]`
- fila: `group py-3 border-b border-[#E8E8E2]`
- numero prioridad: `text-2xl font-black font-mono tabular-nums`
- accion: `text-sm font-semibold text-[#1A1A1A]`
- subtexto: `text-xs text-[#6B6B6B]`
- flecha: `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- hover fila: `hover:bg-gray-50 cursor-pointer transition-colors duration-150`

### Estados
- default: lista ordenada por severidad.
- hover: aparece flecha.
- active: fila seleccionada `bg-yellow-50`.
- loading: 3 filas `h-14 bg-gray-200 animate-pulse rounded`.
- empty: `"No hay prioridades urgentes hoy"` + CTA `"Ver backlog de tareas"`.
- error: `"No pudimos cargar prioridades"` + CTA `"Reintentar"`.

### Breakpoints
- mobile: subtexto 2 lineas max.
- desktop: 1 linea subtexto cuando entra.

### Animacion
- reveal flecha `150ms`.
- entrada filas en cascade `100ms` cada una.

### Jerarquia visual
- Dominante: numero de prioridad + accion.
- Secundario: riesgo/subtexto.

---

## 8) `ScoreEvolutionChart`

### Layout exacto
```text
┌──────────────────────────────────────────────────────────┐
│ Evolucion 6 meses                                       │
│                                                          │
│   • linea principal + area suave                         │
│   • dot final destacado                                  │
│                                                          │
│ Ene  Feb  Mar  Abr  May  Jun                             │
└──────────────────────────────────────────────────────────┘
```

### Recharts exacto
- contenedor: `<ResponsiveContainer width="100%" height={200}>`
- linea principal: `stroke={scoreColor} strokeWidth={2.5}`
- dot final: `r=6 fill={scoreColor} stroke="white" strokeWidth={2}`
- dots intermedios: `r=3` con `opacity-0` y visible en hover.
- area: gradiente vertical `opacity 0.1 -> 0`.
- grid: horizontal only `stroke="#E8E8E2" strokeDasharray="3 3"`.
- eje X: meses abreviados `text-xs fill-gray-400`.
- eje Y: oculto.
- tooltip: `bg-white rounded-lg shadow-lg p-3 border border-[#E8E8E2]`.

### Estados
- default: chart completo.
- hover: activa tooltip + dot visible.
- active: punto seleccionado aumenta a `r=7`.
- loading: `h-[200px] rounded-xl bg-gray-200 animate-pulse`.
- empty: `"Sin historial suficiente para mostrar evolucion"` + CTA `"Cargar nuevo diagnostico"`.
- error: `"No pudimos cargar la evolucion"` + CTA `"Reintentar"`.

### Breakpoints
- mobile: height `180`; menos ticks eje X.
- desktop: height `200`; todos los meses visibles.

### Animacion
- linea entra con `animationDuration={500}` easing `ease-out`.
- area fade-in `250ms`.

### Jerarquia visual
- Dominante: ultimo punto y tendencia.
- Secundario: lectura tooltip.

---

## 9) `PlanBadge`

### Layout exacto
```text
[360°]      -> bg-blue-100 text-blue-700 border border-blue-200
[Copilot]   -> bg-[#FFD600]/20 text-[#1A1A1A] border border-[#FFD600]
```

### Clases exactas
- base: `text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center`
- 360: `bg-blue-100 text-blue-700 border border-blue-200`
- copilot: `bg-[#FFD600]/20 text-[#1A1A1A] border border-[#FFD600]`

### Estados
- default: badge visible.
- hover: `brightness-95`.
- active: `ring-1 ring-offset-1 ring-[#FFD600]`.
- loading: `w-16 h-5 rounded-full bg-gray-200 animate-pulse`.
- empty: no aplica (fallback `"Plan desconocido"` con badge gris).
- error: badge rojo suave `"Error plan"`.

### Breakpoints
- sin cambios mayores; en mobile mantiene `text-[11px]`.

### Animacion
- transicion de color `duration-150`.

### Jerarquia visual
- Secundario en cards/tablas, nunca debe competir con score.

---

## 10) `TaskCard`

### Layout exacto
```text
┌─────────────────────────────────────────────────────┐
│  Revisar proceso de envios         🟡 EN CURSO      │
│  Bloque: Salud · Vence: 30 abr     Nacho            │
│  ─────────────────────────────────────────────────   │
│  [Completar ✓]  [Reasignar]  [Ver detalle →]        │
└─────────────────────────────────────────────────────┘
```

### Clases exactas
- card: `bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4`
- pendiente: `border-l-4 border-l-amber-400`
- en_curso: `border-l-4 border-l-blue-500`
- completada: `border-l-4 border-l-green-500 opacity-60`
- descartada: `border-l-4 border-l-gray-300`
- titulo descartada: `line-through text-gray-400`
- acciones: botones sm con `text-xs font-semibold`.

### Estados
- default: segun estado.
- hover: `hover:shadow-sm transition-shadow duration-150`.
- active: `ring-2 ring-[#FFD600]`.
- loading: `h-24 rounded-xl bg-gray-200 animate-pulse`.
- empty: `"No hay tareas pendientes"` + CTA `"Crear tarea manual"`.
- error: `"No se pudo cargar la tarea"` + `"Reintentar"`.

### Breakpoints
- mobile: acciones en columna.
- desktop: acciones en fila.

### Animacion
- cambio de estado con color transition `200ms`.

### Jerarquia visual
- Dominante: titulo tarea + estado.
- Secundario: vencimiento/responsable.

---

## 11) `EmptyState`

### Layout exacto (base)
```text
      [icono]
Titulo de estado
Descripcion corta del contexto
[CTA principal ->]
```

### Clases exactas
- wrapper: `min-h-[220px] flex flex-col items-center justify-center text-center gap-3 p-6`
- icono: `text-4xl`
- titulo: `text-lg font-semibold text-[#1A1A1A]`
- descripcion: `text-sm text-[#6B6B6B] max-w-sm`
- CTA: `bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-6 py-2.5 hover:brightness-95`

### Copy por contexto
- diagnosticos:
  - titulo: `"No hay diagnosticos para esta cuenta todavia"`
  - descripcion: `"Carga el primer diagnostico para empezar a trackear la salud de la cuenta."`
  - cta: `"Crear primer diagnostico →"`
- tareas:
  - titulo: `"Esta cuenta esta al dia"`
  - descripcion: `"No hay tareas pendientes."`
  - cta: `"Crear tarea manual →"`
- clientes:
  - titulo: `"Todavia no hay cuentas en tu cartera"`
  - descripcion: `"Agrega la primera empresa para empezar a operar."`
  - cta: `"Agregar empresa →"`
- recomendaciones:
  - titulo: `"No hay recomendaciones activas"`
  - descripcion: `"La cuenta no tiene alertas operativas ahora."`
  - cta: `"Crear accion preventiva →"`

### Estados
- default: muestra icono + copy + CTA.
- hover: CTA realza brillo.
- active: CTA `ring-2 ring-[#FFD600]`.
- loading: bloque centrado `animate-pulse`.
- empty: este es el estado en si.
- error: variante roja suave con copy `"No pudimos cargar este estado vacio"`.

### Breakpoints
- mobile: padding `p-4`, titulo `text-base`.
- desktop: padding `p-6`, titulo `text-lg`.

### Animacion
- fade-in contenedor `200ms ease-out`.

### Jerarquia visual
- Dominante: titulo.
- Secundario: CTA.

---

## 12) `LoadingSkeleton`

### Variantes obligatorias y clases
- `score-hero`:
  - `flex flex-col items-center gap-3`
  - circulo: `w-24 h-24 rounded-full bg-gray-200 animate-pulse`
  - lineas: `h-4 w-40 bg-gray-200 rounded animate-pulse`
- `recommendation-list`:
  - `space-y-3`
  - item: `h-32 rounded-xl bg-gray-200 animate-pulse`
- `company-table`:
  - `space-y-2`
  - fila: `h-16 rounded-lg bg-gray-200 animate-pulse`
- `diagnostic-form`:
  - `space-y-3`
  - label: `h-3 w-24 bg-gray-200 rounded animate-pulse`
  - input: `h-12 w-full bg-gray-200 rounded-lg animate-pulse`
- `chart`:
  - `h-48 rounded-xl bg-gray-200 animate-pulse`

### Estados
- default: mostrar skeleton segun variante.
- hover: no aplica (sin interaccion).
- active: no aplica.
- loading: estado principal.
- empty: no aplica.
- error: fallback `"No pudimos renderizar loading state"`.

### Breakpoints
- mobile: compactar alturas (`h-40` en chart).
- desktop: alturas completas.

### Animacion
- pulse default tailwind (`animate-pulse`) en todos.
- no usar spinner solo.

### Jerarquia visual
- Debe replicar estructura del contenido final para evitar salto visual al hidratar.
