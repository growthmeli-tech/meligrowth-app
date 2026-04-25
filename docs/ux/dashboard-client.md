# Dashboard Client (`/client/dashboard`)

## Objetivo de la pantalla
Explicar al cliente en lenguaje simple si su cuenta mejora, qué se está haciendo y qué necesita aportar para sostener el crecimiento.

## Usuario principal
- Vendedor de Mercado Libre (no técnico, sesiones cortas)

## Principio editorial
- Hablar en resultados y progreso.
- Evitar jerga operativa interna (`ACOS`, `TACOS`, `RLS`, etc.).

## Preguntas que debe responder
- "¿Estoy mejorando?"
- "¿Qué áreas están bien y cuáles en proceso?"
- "¿Qué me falta subir para que el equipo avance?"

## Wireframe simplificado
```text
┌─────────────────────────────────────────────────────┐
│ SUPLEMENTOS MADERO                                 │
│ Plan Growth · Desde enero 2026                     │
├─────────────────────────────────────────────────────┤
│ TU CUENTA ESTE MES                                 │
│ [77] Sólida                                        │
│ ↑ Subió 5 puntos vs el mes pasado                  │
│ Actualizado hoy                                    │
├─────────────────────────────────────────────────────┤
│ QUÉ ESTÁ PASANDO                                   │
│ ✅ Logística: bien                                 │
│ ✅ Stock: muy bien                                 │
│ ⚠️ Publicaciones: en proceso                       │
│ ⚠️ Salud: revisando                                │
├─────────────────────────────────────────────────────┤
│ EVOLUCIÓN (6 meses)                                │
│ [EvolutionChart]                                   │
├─────────────────────────────────────────────────────┤
│ TU REPORTE QUINCENAL                               │
│ Último reporte: 15/04/2026 [Ver]                  │
├─────────────────────────────────────────────────────┤
│ ARCHIVOS PENDIENTES                                │
│ ✅ SKUs y stock                                    │
│ ✅ Márgenes                                        │
│ ⚠️ Ficha técnica [Subir ahora]                     │
└─────────────────────────────────────────────────────┘
```

## Especificación de experiencia
- Score principal grande + delta obligatorio.
- Estado por área con iconografía simple (`✅`, `⚠️`, `🔴`) y texto humano.
- Gráfico de evolución como prueba de progreso mensual.
- CTA de archivo faltante siempre visible (alto contraste).

## Especificación de componentes UX (para Agente UI)

### `EvolutionChart`
- Línea de score 6 meses.
- Tooltip simple: "Mes X: 74 puntos".
- Destacar último punto y variación mensual.
- Debe ser legible en mobile (sin saturar ejes).

### `EmptyState` (cliente)
- Si no hay diagnóstico:
  - copy: "Todavía estamos preparando tu primera medición."
  - CTA: `Contactar a tu operador`.

## Reglas de lenguaje
- Sí usar: "mejorando", "en proceso", "revisando", "listo".
- No usar: "score bloque ads", "incidencias logísticas", "KPI técnico".
- Cada mensaje debe poder entenderlo alguien sin contexto interno.

## Estados de la pantalla

### Cargando
- Skeleton de score principal + checklist + gráfico.

### Con datos
- Render completo con progreso y próximos pasos.

### Vacío
- Explicar que falta el diagnóstico inicial y qué sucederá después.

### Error
- Mensaje amigable:
  - "No pudimos cargar tu resumen ahora. Reintentá en unos minutos."

## Edge cases
- Score estable (delta 0): mostrar "Se mantuvo igual este mes".
- Delta negativo: copy empático + foco en plan de recuperación.
- Falta de historial para gráfico: mostrar últimos 2 puntos disponibles.
- Archivos todos completos: reemplazar CTA por mensaje positivo de cumplimiento.
- Cliente sin plan activo: mostrar estado administrativo y canal de contacto.

## KPIs UX
- Comprensión del estado general en < 10 segundos.
- Click rate en CTA de archivo pendiente > 30%.
- Disminución de consultas de soporte por "no entiendo el reporte".
