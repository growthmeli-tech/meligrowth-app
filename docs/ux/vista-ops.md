# Vista Operativa (`/ops/dashboard`)

## Objetivo
Que el operador entre y en 10 segundos sepa exactamente que hacer hoy. Esta vista es mobile-first y orientada a ejecucion inmediata.

## Wireframe mobile-first
```text
┌──────────────────────────────┐
│ EMPRESA ABC    Score: 77 🔵  │
│ Hoy: 3 urgentes             │
├──────────────────────────────┤
│ HOY HACES ESTO              │
│ 🔴 1. Pausar ads            │
│ ACOS al 200%. Perdes plata. │
│ [Ver detalle]               │
│                              │
│ 🟡 2. Revisar envios        │
│ 90% a tiempo. Riesgo pena.  │
│ [Ver detalle]               │
│                              │
│ 🟡 3. Reponer 3 SKUs        │
│ Sin stock hace 5 dias.      │
│ [Ver detalle]               │
├──────────────────────────────┤
│ TAREAS         [+ Nueva]    │
│ 2 pendientes · 1 en curso   │
├──────────────────────────────┤
│ BLOQUES                     │
│ 01 67🟡 02 81🔵 03 15🔴     │
│ 04 81🔵 05 82🔵             │
└──────────────────────────────┘
```

## Jerarquia innegociable
- Primer viewport: prioridades del dia (sin scroll).
- Cada prioridad con una sola accion visible.
- Lenguaje directo: "Pausar ads", "Revisar envios", "Reponer SKUs".
- Estado de tareas en segundo bloque, resumen de bloques al final.

## Desktop adaptation
- Sidebar izquierda con rutas:
  - `/ops/dashboard`
  - `/ops/alerts`
  - `/ops/tasks`
  - `/ops/ads`
  - `/ops/stock`
- Columna principal mantiene lista de prioridades arriba.
- Panel secundario para tareas y bloque de score por bloque.

## Reglas UX
- Si hay urgentes, el primero siempre es rojo y ocupa primera card.
- Solo un CTA por card de prioridad (`Ver detalle` o `Ejecutar ahora`).
- No usar lenguaje abstracto ("optimizar", "mejorar"). Usar verbos accionables.
- Mostrar impacto esperado en puntos cuando aplique.

## Estados
### Loading
- Skeleton de header + 3 cards de prioridad + bloque tareas.

### Con datos
- Top 3 prioridades visibles y ordenadas por severidad/impacto.

### Sin prioridades
- Empty state:
  - "No hay urgencias para hoy".
  - CTA: `Ver tareas pendientes`.

### Error
- Banner superior con CTA `Reintentar`.

## Edge cases
- Mas de 5 prioridades: mostrar top 3 + link `Ver todas`.
- Sin score global actualizado: mostrar timestamp de ultimo diagnostico valido.
- Cuenta con multiples operadores: indicar responsable en cada prioridad.
- Sin tareas creadas: CTA `Crear primera tarea`.

## Accion principal
Resolver la prioridad numero 1 del dia.
