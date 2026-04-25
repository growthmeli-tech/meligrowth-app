# Dashboard Operator (`/operator/dashboard`)

## Objetivo de la pantalla
Permitir que el equipo operator detecte urgencias en menos de 3 segundos, priorice cuentas en riesgo y ejecute acciones sin navegación profunda.

## Usuario principal
- Luciano (overview ejecutivo, sesiones cortas en mobile)
- Nacho (operación diaria, urgencia alta, múltiples revisitas)

## Preguntas que debe responder
- "¿Hay algo urgente hoy?"
- "¿Qué cuentas requieren intervención inmediata?"
- "¿Cómo está distribuida la cartera por estado?"

## Jerarquía de información (orden obligatorio)
1. Header + notificaciones
2. `AlertBanner` (solo si hay nivel 1 o 2)
3. Resumen de cartera (distribución semáforo)
4. Clientes en riesgo (top 3)
5. Acciones pendientes por vencer
6. Grilla de cartera filtrable

## Wireframe (mobile-first)
```text
┌──────────────────────────────────────────────┐
│ MELI GROWTH                       🔔 (3)     │
│ Hola, Luciano                     Sáb 25 abr │
├──────────────────────────────────────────────┤
│ ALERTBANNER (si hay urgencias)              │
│ 🔴 2 urgentes · 1 crítica                   │
│ • Suplementos Madero: score 37 (-11)        │
│ • Casa Deco: envíos a tiempo 88%            │
│ [Ver alertas] [Ir a cuenta crítica]         │
├──────────────────────────────────────────────┤
│ CARTERA (32 cuentas)                         │
│ Platinum 8 | Sólido 12 | Desarrollo 7       │
│ Riesgo 3 | Crítico 2                         │
│ [barra proporcional por estado]              │
├──────────────────────────────────────────────┤
│ CLIENTES EN RIESGO                           │
│ [Card] Cliente A 42  ↓-8  Acción pendiente   │
│ [Card] Cliente B 47 ↓-12  Sin sync ML 2 días │
│ [Card] Cliente C 39  ↓-3  Incidencia ads     │
│                            [Ver todos]       │
├──────────────────────────────────────────────┤
│ ACCIONES PENDIENTES (14)                     │
│ 5 urgentes · 4 vencen hoy                    │
│ [Ver backlog]                                │
├──────────────────────────────────────────────┤
│ FILTROS + BUSCADOR + GRID DE CLIENTES        │
│ [cards compactas con score + delta + owner]  │
└──────────────────────────────────────────────┘
```

## Desktop layout
- Sidebar izquierda fija (navegación operator).
- Primera franja en 3 columnas: `AlertBanner` ancho completo + resumen + acciones.
- Segunda franja: clientes en riesgo (2 columnas) + panel "sin actualizar +7 días".
- Tercera franja: filtros avanzados + grilla 3 columnas.

## Especificación de componentes UX (para Agente UI)

### `AlertBanner`
- Ubicación: inmediatamente debajo del saludo.
- Aparición: solo con alertas nivel 1/2.
- Contenido mínimo:
  - contador de alertas críticas/urgentes,
  - hasta 2 eventos prioritarios,
  - CTA primario "Ver alertas",
  - CTA secundario "Ir a cuenta".
- Comportamiento:
  - no colapsable en nivel 1,
  - en nivel 2 puede minimizarse por sesión,
  - animación pulse suave solo para nivel 1.

### `ClientStatusBadge`
- Debe mostrar estado (`Platinum`, `Muy bueno`, `Sólido`, `En desarrollo`, `En riesgo`, `Crítico`).
- Incluye color semáforo + icono de tendencia si hay delta.
- En dashboard operator se usa en cards de riesgo y en grilla de cartera.

### `EmptyState`
- Si no hay clientes por filtros:
  - texto: "No hay cuentas con estos filtros".
  - CTA primario: "Limpiar filtros".
  - CTA secundario: "Ver cartera completa".

## Reglas de diseño
- Lo urgente va primero; nunca debajo de métricas generales.
- Máximo 3 clientes en riesgo visibles; el resto via CTA.
- Los scores siempre se acompañan con delta y fecha de actualización.
- Evitar tablas densas en mobile; usar cards con 3 datos clave.
- CTA principal visible sin scroll: `Nuevo cliente`.

## Estados de la pantalla

### Cargando
- Skeleton estructural:
  - barra header,
  - bloque de `AlertBanner`,
  - 3 métricas,
  - 3 cards de riesgo,
  - 6 cards de cartera.
- Nunca spinner aislado.

### Con datos
- Renderiza toda la jerarquía completa.
- `AlertBanner` solo cuando aplica.

### Vacío
- Cartera vacía inicial: explicar primer paso.
- CTA: `Nuevo cliente` + guía breve de onboarding.

### Error
- Banner superior rojo con copy accionable:
  - "No pudimos cargar la cartera. Reintentá o revisá conexión Supabase."
- Botón: `Reintentar`.

## Edge cases
- Más de 20 alertas: mostrar top 5 + contador total.
- Cuentas sin diagnóstico: etiquetar como `Sin diagnóstico` y subir prioridad visual.
- Delta inexistente (primer diagnóstico): reemplazar por "Base inicial".
- Datos ML desactualizados (>72h): badge naranja "Datos pendientes de sync".
- Usuario mobile con poco ancho: compactar texto y mantener alertas visibles.

## Métricas UX de éxito
- Tiempo a primera acción: < 15 segundos.
- Detección de alerta crítica: < 3 segundos.
- Tasa de uso de CTA `Ver alertas`: > 60% cuando hay nivel 1/2.
