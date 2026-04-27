# Vista Interna MG (`/internal/dashboard`)

## Objetivo
Concentrar la operacion de cartera en una sola consola para que el equipo detecte riesgo en segundos, priorice por impacto y entre a cada cuenta sin friccion.

## Wireframe de referencia (desktop-first)
```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│  SIDEBAR     │  HEADER: Buenos dias, Joaquin · Lunes 27                    │
│              ├──────────────────────────────────────────────────────────────┤
│  MG Logo     │  ALERTAS CRITICAS (solo si existen)                         │
│  Dashboard   │  🔴 Empresa X — Ads destruyendo margen                      │
│  Cartera     │  🔴 Empresa Y — Salud critica                                │
│  Settings    ├──────────────────────────────────────────────────────────────┤
│              │  RESUMEN DE CARTERA                                         │
│  Joaquin     │  [12 activas] [3 Copilot] [2 en riesgo]                     │
│  internal    ├──────────────────────────────────────────────────────────────┤
│              │  FILTROS: Plan · Score · Urgencia · Responsable             │
│              ├──────────────────────────────────────────────────────────────┤
│              │  TABLA DE CUENTAS                                           │
│              │  Company · Plan · Score · Estado · Alerta · Acciones        │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

## Composicion y jerarquia visual
- Alertas urgentes arriba de todo el contenido (si existen).
- Primer numero dominante: cuentas en riesgo o score mas bajo del portfolio.
- Tabla como cuerpo principal; sin cards dispersas en desktop.
- Sidebar fija con identidad MG visible y avatar persistente.

## Sidebar (especificacion exacta)
- Logo: `MELIGROWTH` + icono de barras amarillas.
- Items con iconos: `Dashboard`, `Cartera`, `Settings`.
- Badge rojo en item de alertas cuando haya urgentes.
- Footer con avatar, nombre (`Joaquin`) y rol (`internal`).
- Estado activo con fondo amarillo suave y texto oscuro.

## Tabla de cuentas (premium table spec)
- Orden default: `score asc` (peores primero).
- Hover fila: fondo sutil `#F5F5F0`, cursor pointer, accion rapida visible.
- Separador visual entre planes:
  - bloque superior: `Plan 360°` (borde izquierdo azul `#2563EB`).
  - bloque inferior: `Plan 360° Copilot` (borde izquierdo amarillo `#FFD600`).
- Columna `Plan`:
  - badge `360°` azul.
  - badge `Copilot` amarillo MG.
- Columna `Score`:
  - numero con semaforo + barra de progreso inline.
- Columna `Estado`:
  - chip de estado (`Platinum`, `Muy bueno`, `Solido`, `En desarrollo`, `En riesgo`, `Critico`).
- Columna `Alerta`:
  - icono `🔴/🟡/✅` + texto de 1 linea max.
- Columna `Acciones`:
  - boton primario `Ver cuenta`.
  - menu contextual `···` para acciones secundarias.

## Filtros visibles (siempre en viewport)
- `Plan`: todos / 360° / Copilot.
- `Score`: rangos semaforo.
- `Urgencia`: urgente / alta / media / baja.
- `Responsable`: operador asignado.
- `Reset filtros` como accion secundaria.

## Estados de pantalla
### Loading
- Skeleton de header + banner + tabla de 8 filas con forma real.

### Con datos
- Alertas solo si hay nivel urgente/alta.
- Tabla con paginacion compacta y sticky header.

### Sin resultados por filtros
- Empty state inline en tabla:
  - mensaje: "No hay cuentas con estos filtros".
  - CTA: `Limpiar filtros`.

### Error
- Banner superior rojo con copy operativo.
- CTA: `Reintentar carga`.

## Edge cases
- Company con multiples `ml_accounts`: fila expandible para ver cuentas hijas.
- Cuenta sin score: etiqueta `Sin diagnostico` con CTA `Crear diagnostico`.
- Sin alertas: se elimina bloque de alertas (no dejar placeholder vacio).
- Mas de 50 cuentas: sticky filtros + paginacion + busqueda por nombre.

## Accion principal de la pantalla
`Ver cuenta` es la unica accion principal repetida por fila; evita dispersion de CTAs primarios.
