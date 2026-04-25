# Panel de Recomendaciones por Cuenta

## Objetivo del módulo
Convertir recomendaciones del motor en decisiones ejecutables por prioridad, con contexto de impacto y CTA directo a acción.

## Ubicación sugerida
- Vista de cuenta operator (`/operator/clients/[id]`), debajo de score global.
- También reutilizable como sección dedicada en tab "Acciones".

## Estructura general
- Agrupado por bloque (`Salud`, `Publicaciones`, `Ads`, `Logística`, `Stock`).
- Orden interno por prioridad (`urgente`, `alta`, `media`).
- Filtros rápidos por prioridad y estado de ejecución.

## Card de recomendación (wireframe)
```text
┌──────────────────────────────────────────────────────┐
│ 🔴 URGENTE                      Bloque: Salud        │
│ Envíos a tiempo en 90%                                │
│ Riesgo: penalización activa posible                   │
│                                                       │
│ QUÉ HACER                                             │
│ Revisar SLA con logística y recuperar >95% esta semana│
│                                                       │
│ MÉTRICA ACTUAL: 90%                                   │
│ OBJETIVO: >95%                                        │
│ IMPACTO ESTIMADO: +8 pts en score Salud               │
│ FUENTE: ML API · Confianza alta                       │
│                                                       │
│ [Crear acción] [Marcar en curso] [Ver evidencia]      │
└──────────────────────────────────────────────────────┘
```

## Especificación de `RecommendationCard` (para Agente UI)
- Header:
  - chip de prioridad,
  - bloque asociado,
  - fecha sugerida de resolución.
- Cuerpo:
  - título directo (problema),
  - contexto de riesgo,
  - sección "Qué hacer" orientada a acción concreta.
- Footer:
  - métrica actual,
  - objetivo benchmark,
  - impacto estimado en puntos,
  - fuente y nivel de confianza.
- Acciones:
  - `Crear acción` (primaria),
  - `Marcar en curso` (secundaria),
  - `Ver evidencia` (terciaria, opcional).

## Reglas visuales
- Borde izquierdo por prioridad:
  - urgente rojo,
  - alta naranja,
  - media amarillo.
- Altura de card flexible pero estable (evitar saltos de layout).
- Impacto siempre visible (nunca escondido en tooltip).
- Si no hay objetivo cuantitativo, mostrar objetivo cualitativo estándar.

## Estados del panel

### Cargando
- 3 skeleton cards con distribución real de contenido.

### Con datos
- Cards ordenadas por prioridad y bloque.

### Sin recomendaciones
- Empty state:
  - "No hay recomendaciones activas para esta cuenta."
  - CTA: `Crear acción preventiva`.

### Error
- Mensaje inline dentro del panel con botón `Reintentar`.

## Edge cases
- Más de 12 recomendaciones: paginación o "ver más" incremental.
- Recomendación duplicada por misma métrica: consolidar en una sola card.
- Sin impacto estimado: mostrar etiqueta `impacto por validar`.
- Recomendación vencida: badge adicional `atrasada`.
- Acción ya creada para recomendación: reemplazar CTA por "Ver acción".

## Relación con acciones operativas
- Cada recomendación debe mapear a una acción rastreable.
- Guardar vínculo `recommendationId -> actionId` para trazabilidad.
- Permitir estado de ciclo: `pendiente`, `en_curso`, `resuelta`.
