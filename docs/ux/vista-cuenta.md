# Vista de Cuenta (`/internal/clients/[id]`)

## Objetivo
Pantalla de mayor densidad informativa del producto. Debe permitir escaneo total en 5 segundos: estado global, peor bloque y siguiente accion.

## Wireframe de referencia
```text
┌─────────────────────────────────────────────────────────────────┐
│ ← Cartera · EMPRESA ABC · Plan Copilot 🟡                      │
├──────────────┬──────────────────────────────────────────────────┤
│ SCORE        │ RECOMENDACIONES                                 │
│              │ 🔴 URGENTE — Ads critico                        │
│  [  77  ]    │ Pausar campanas. ACOS al 200%.                  │
│  Solido      │ [Crear tarea]                                   │
│  ↑ +5 pts    │                                                  │
│              │ 🟡 ALTA — Envios a tiempo                        │
│ BLOQUES      │ Penalizacion posible. Revisar SLA.              │
│ 01 67 🟡     │ [Crear tarea]                                   │
│ 02 81 🔵     │                                                  │
│ 03 15 🔴     │ TAREAS                                           │
│ 04 81 🔵     │ [3 pendientes · 1 urgente]                       │
│ 05 82 🔵     │                                                  │
├──────────────┴──────────────────────────────────────────────────┤
│ TABS: Diagnostico · Historial · Archivos · Config              │
└─────────────────────────────────────────────────────────────────┘
```

## Jerarquia obligatoria
- Primer elemento visual: score global (`text-6xl font-black`) con color semaforo.
- Segundo bloque: recomendaciones visibles siempre (nunca ocultas en tabs).
- Tercer bloque: chips de los 5 bloques con enfasis en el peor score.
- Cuarto bloque: tabs de profundizacion.

## Columna izquierda (score + bloques)
- `ScoreDisplay` dominante:
  - numero, estado, delta y fecha de actualizacion.
  - color segun sistema semaforo.
- `BlockScoresRow` vertical/compacta con 5 chips.
- Peor bloque:
  - borde mas grueso.
  - microetiqueta `Prioridad actual`.

## Columna derecha (recomendaciones + tareas)
- Recomendaciones ordenadas por prioridad: urgente > alta > media > baja.
- Cada recomendacion usa borde izquierdo por prioridad.
- Cada card muestra exactamente un CTA visible:
  - `Crear tarea` para operator.
  - `Solicitar accion` para manager.
- Panel de tareas compacto siempre visible debajo de recomendaciones.

## Reglas de contenido
- Lenguaje operativo directo para internal/ops.
- Metricas en fuente mono (`font-mono`).
- No esconder la principal recomendacion por encima de tabs o acordeones.
- Si hay alerta urgente, aparece antes de tareas y tabs.

## Estados de la pantalla
### Loading
- Skeleton dividido en dos columnas con forma real (score, 3 recomendaciones, chips, tabs).

### Con datos
- Layout completo con score, recomendaciones y tabs.

### Sin diagnostico
- Mensaje: "Esta cuenta aun no tiene diagnostico inicial".
- CTA principal: `Crear primer diagnostico`.

### Error
- Banner superior de error + CTA `Reintentar`.

## Edge cases
- `ads` sin datos: chip `03 --` con estado `Sin datos`, sin penalizar visualmente.
- Primera medicion: ocultar delta y mostrar `Base inicial`.
- Cuenta pausada/churned: bloquear acciones de ejecucion y mostrar badge administrativo.
- Multiples cuentas ML por company: selector de cuenta debajo del header.

## Accion principal de la pantalla
`Crear tarea` sobre la recomendacion mas urgente.
