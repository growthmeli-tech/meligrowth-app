# Formulario de Diagnostico (`/internal/clients/[id]/diagnostic/new`)

## Objetivo
Hacer que la carga quincenal se sienta como un asistente inteligente: rapido, guiado y con impacto visible en tiempo real.

## Estructura de experiencia (obligatoria)
- Dos zonas diferenciadas:
  - Zona A: datos rapidos (obligatoria, 10 min max).
  - Zona B: analisis profundo (opcional, no penaliza).
- Zona A sobre fondo blanco.
- Zona B sobre fondo `#F5F5F0` con etiqueta `Opcional — no penaliza`.

## Wireframe de trabajo
```text
┌──────────────────────────────────────────────────────────────┐
│ EMPRESA ABC · Nuevo diagnostico                             │
├──────────────────────────────────────────────────────────────┤
│ Zona A — Datos rapidos (obligatoria)                        │
│ Reclamos %                                     🟢 API        │
│ [ 0.6 ]                                                     │
│ 🟡 En desarrollo — benchmark: <0.5% solido                  │
│ Objetivo: llevar a <0.5%                                    │
│                                                              │
│ 01 SALUD                             [67] 🟡 En desarrollo   │
│ ████████████████░░░░░░░░░░  67/100                           │
├──────────────────────────────────────────────────────────────┤
│ Zona B — Opcional (no penaliza)                              │
│ Campos de contexto interno, lead time, etc.                  │
├──────────────────────────────────────────────────────────────┤
│ Score global en tiempo real: [63] En riesgo ↓ -5            │
│ [Guardar diagnostico]                                        │
└──────────────────────────────────────────────────────────────┘
```

## Campo con benchmark inline (`DiagnosticFieldBenchmark`)
- Estructura fija:
  - label de metrica.
  - badge de fuente (`🟢 API` o `✏️ Manual`).
  - input.
  - estado semaforo.
  - benchmark y objetivo en texto corto.
- Feedback al tipear, sin esperar blur o submit.

## Score en tiempo real por bloque
- Cada bloque muestra:
  - id (`01`, `02`, `03`, `04`, `05`),
  - score numerico,
  - estado semaforo,
  - barra de progreso animada.
- Actualizacion sugerida: debounce 150-250ms.

## Comportamiento de fuentes de datos
- Prefill API: badge `🟢 API` y tooltip "Dato de API ML".
- Campo no cubierto por API: badge `✏️ Manual`.
- Si falla sync, formulario sigue habilitado en modo manual.

## Post-submit (sin redireccion)
```text
┌──────────────────────────────────────────────────────────────┐
│ ✅ Diagnostico guardado                                     │
│ [  63  ] En riesgo  ↓-5 pts vs anterior                     │
│ 🔴 URGENTE: Ads destruyendo margen — pausar ahora           │
│ 🟡 ALTA: Envios a tiempo al 90%                             │
│ [Ver cuenta completa] [Crear tareas automaticas]            │
└──────────────────────────────────────────────────────────────┘
```

## Reglas UX innegociables
- Nunca redirigir automaticamente al listado.
- Validaciones inline por campo (no solo toast global).
- Score visible durante toda la carga.
- Alertas urgentes de inputs criticos (ejemplo ads) en rojo inmediato.

## Estados
### Loading
- Skeleton que respeta estructura real de zonas y barras de score.

### Con datos
- Zona A expandida por defecto, Zona B plegada.

### Sin prefill
- Todos los campos con `✏️ Manual` y aviso de sync pendiente.

### Error submit
- Banner rojo + conservar inputs para no perder trabajo.

## Edge cases
- Valores fuera de rango: correccion y mensaje inmediato.
- Ads con `ventas_ads = 0`: alerta critica contextual.
- Salida accidental con cambios: modal de confirmacion.
- Bloque sin datos: marcar `Sin datos` sin romper submit global.
