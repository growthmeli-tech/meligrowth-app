# Vista de Cuenta (`/operator/clients/[id]`)

## Objetivo de la pantalla
Concentrar diagnóstico actual, evolución y recomendaciones accionables para decidir "qué hacer esta semana" en una cuenta específica.

## Usuario principal
- Joaquín (análisis profundo, desktop)
- Nacho (operación rápida con foco en urgencias)

## Preguntas que debe responder
- "¿Cómo está esta cuenta hoy?"
- "¿Qué cambió vs diagnóstico anterior?"
- "¿Qué recomendaciones tengo que ejecutar primero?"

## Wireframe base
```text
┌─────────────────────────────────────────────────────────┐
│ ← Cartera             SUPLEMENTOS MADERO · Growth      │
│                        Activo · Último sync ML: hoy     │
├─────────────────────────────────────────────────────────┤
│ SCORE GLOBAL                                            │
│ [ 77 ] Sólido  ↑+5 vs mes anterior                      │
│ Última actualización: 20/04/2026                        │
├─────────────────────────────────────────────────────────┤
│ RECOMENDACIONES (3 pendientes)                          │
│ 🔴 Envíos a tiempo al 90% (impacto +8) [Crear acción]   │
│ 🟠 ACOS alto vs margen (impacto +6) [Ver detalle]       │
│ 🟡 Catálogo optimizable (impacto +3)                    │
├─────────────────────────────────────────────────────────┤
│ BLOQUES                                                 │
│ Salud 67 🟡 | Publicaciones 81 🔵 | Ads 85 🟢           │
│ Logística 81 🔵 | Stock 89 🟢                           │
├─────────────────────────────────────────────────────────┤
│ TABS: [Diagnóstico] [Evolución] [Acciones]             │
├─────────────────────────────────────────────────────────┤
│ CONTENIDO TAB                                            │
└─────────────────────────────────────────────────────────┘
```

## Jerarquía visual obligatoria
1. `ScoreDisplay` (dominante)
2. Recomendaciones del motor (siempre visibles, nunca ocultas tras tab)
3. `BlockScoreRow` de los 5 bloques
4. Acciones/diagnóstico detallado por tab
5. CTAs persistentes: `Nuevo diagnóstico`, `Ver reporte`

## Presentación de recomendaciones del motor
- Ubicación fija bajo score global.
- Orden por prioridad (`urgente` > `alta` > `media`).
- Cada item muestra:
  - bloque afectado,
  - métrica actual,
  - objetivo benchmark,
  - impacto estimado en puntos,
  - CTA contextual (`Crear acción`, `Marcar en curso`, `Ver cuenta`).
- Si hay más de 3, mostrar top 3 + enlace "Ver todas las recomendaciones".

## Especificación de componentes UX (para Agente UI)

### `ScoreDisplay`
- Elementos:
  - número grande (`text-6xl`, fuente black),
  - etiqueta de estado semáforo,
  - delta con flecha y color,
  - timestamp de actualización.
- Debe soportar:
  - estado sin delta ("Base inicial"),
  - estado negativo/positivo.

### `BlockScoreRow`
- Fila compacta con 5 bloques y color semáforo inline.
- Interacción: click en bloque filtra el tab `Diagnóstico` a métricas del bloque.
- Tooltip opcional con benchmark del bloque.

### `RecommendationCard` (versión resumida)
- Se usa en lista superior de recomendaciones.
- Variante compacta (1 línea de título + impacto + CTA).
- Prioridad indicada por borde izquierdo y chip.

## Reglas de diseño
- El score global ocupa el área de máxima atención.
- El operador debe ver recomendaciones sin cambiar de tab.
- No esconder acciones críticas debajo de folds largos.
- Lenguaje operativo directo: "Revisar SLA", "Reducir ACOS", "Corregir stock".
- Mantener consistencia de semáforo entre score global, bloques y recomendaciones.

## Estados de la pantalla

### Cargando
- Skeleton de score principal + 3 recommendation cards + tabs.

### Con datos
- Score + recomendaciones + tabs activos.

### Sin diagnóstico
- Empty state específico:
  - copy: "Esta cuenta aún no tiene diagnóstico inicial."
  - CTA primario: `Cargar diagnóstico`.
  - CTA secundario: `Ver archivos`.

### Error
- Error inline sobre contenido, manteniendo header de cuenta.
- Botón de recuperación: `Reintentar carga`.

## Edge cases
- Score sin historial previo: ocultar delta, mostrar "Primera medición".
- Recomendación sin impacto estimado: mostrar "Impacto cualitativo".
- Cuenta inactiva: bloquear CTAs de ejecución y mostrar estado.
- Sin recomendaciones del motor: mostrar mensaje "Sin urgencias detectadas" + CTA a crear acción manual.
- Score global crítico + tabs no diagnóstico: pin de alerta persistente en header.

## KPIs UX
- Tiempo hasta abrir recomendación prioritaria: < 10 segundos.
- Tasa de conversión recomendación -> acción creada: > 40%.
