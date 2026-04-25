# Sistema de Notificaciones y Alertas

## Objetivo del sistema
Asegurar que ningún evento crítico pase desapercibido y que cada rol reciba solo alertas accionables para su contexto.

## Jerarquía de alertas (obligatoria)

### Nivel 1 - Crítico (rojo)
- Triggers:
  - score global < 40,
  - caída de bloque crítico con riesgo inmediato.
- Canales:
  - `AlertBanner` fijo en dashboard,
  - badge en navbar,
  - push interna.
- Regla:
  - no descartable sin acción explícita.

### Nivel 2 - Urgente (naranja)
- Triggers:
  - caída > 10 puntos en un ciclo,
  - recomendación urgente del motor.
- Canales:
  - banner dashboard,
  - badge navbar.

### Nivel 3 - Importante (amarillo)
- Triggers:
  - recomendaciones nuevas de prioridad alta/media,
  - archivos críticos faltantes.
- Canales:
  - badge navbar,
  - lista en centro de notificaciones.

### Nivel 4 - Informativo (azul)
- Triggers:
  - reporte quincenal generado,
  - diagnóstico guardado correctamente.
- Canales:
  - centro de notificaciones.

## Comportamiento por rol

### Operator
- Ve alertas por cartera completa asignada.
- Prioriza por criticidad y fecha.
- Puede marcar como vista desde cuenta afectada.

### Client
- Solo ve alertas de su cuenta.
- Mensajes en lenguaje simple:
  - "Tu reporte está listo"
  - "Falta subir ficha técnica".

## Wireframe de experiencia
```text
┌──────────────────────────────────────────────────┐
│ 🔔 Notificaciones (12)                            │
├──────────────────────────────────────────────────┤
│ [Crítico] Score cayó a 37 en Suplementos Madero  │
│ Hace 10 min  [Ir a cuenta] [Marcar vista]        │
├──────────────────────────────────────────────────┤
│ [Urgente] ACOS fuera de rango rentable           │
│ Hace 1 h     [Ver recomendación]                 │
├──────────────────────────────────────────────────┤
│ [Importante] Nueva recomendación en Publicaciones│
│ Hace 3 h     [Abrir panel]                       │
├──────────────────────────────────────────────────┤
│ [Info] Reporte quincenal disponible              │
│ Hace 1 día   [Ver reporte]                       │
└──────────────────────────────────────────────────┘
```

## Reglas UX
- Niveles 1 y 2 visibles en dashboard sin navegación adicional.
- Auto-lectura cuando se abre la cuenta asociada (con ventana de 5s).
- Agrupar eventos repetidos por cuenta + tipo de problema.
- No enviar notificaciones cruzadas entre cuentas de distintos clientes.
- Mantener historial consultable en `/operator/notifications` y `/client/notifications`.

## Especificación de `AlertBanner` (cross-screen)
- Inputs:
  - lista de alertas críticas/urgentes,
  - contadores por nivel.
- Outputs:
  - resumen visual y CTA a resolución.
- Variantes:
  - compacta mobile,
  - extendida desktop.

## Estados del sistema

### Sin notificaciones
- Mostrar estado neutro con icono y copy:
  - "No hay alertas pendientes."

### Con notificaciones
- Orden estricto por severidad y recencia.

### Error al cargar
- Mantener badge previo y mostrar aviso de reintento.

## Edge cases
- Pico de alertas (>100): paginación + resumen agregado.
- Notificación sin cuenta vinculada: enviar a cola de revisión interna.
- Evento resuelto antes de leer: marcar como "resuelta automáticamente".
- Duplicados por múltiples diagnósticos en el día: consolidación por tipo.

## KPIs de efectividad
- Tiempo medio de lectura de nivel 1: < 2 minutos.
- Tiempo medio de apertura de cuenta desde alerta: < 30 segundos.
- Reducción de alertas críticas no atendidas > 24h.
