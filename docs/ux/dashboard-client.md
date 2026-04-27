# Vista Gerencial (`/brand/dashboard`)

## Objetivo
Demostrar valor de gestion mensual con lenguaje simple y visual premium. El cliente debe entender progreso y control sin interpretar jerga tecnica.

## Principios de copy
- Nunca usar jerga tecnica directa (`ACOS`, `TACOS`, `score bloque`).
- Traducir a lenguaje negocio:
  - "eficiencia publicitaria",
  - "salud de tu cuenta",
  - "areas a reforzar esta semana".
- Siempre mostrar contexto temporal: "este mes", "vs mes pasado".

## Wireframe de referencia
```text
┌──────────────────────────────────────────────────────────────┐
│ EMPRESA ABC                                Abril 2026       │
│ Plan 360° · Activa desde enero                              │
│ [Selector de cuenta ▼] (si hay multiples ml_accounts)       │
├──────────────────────────────────────────────────────────────┤
│ TU CUENTA ESTE MES                                           │
│                                                              │
│     [  77  ]                                                 │
│     Tu cuenta esta Solida                                    │
│     ↑ Subio 5 puntos vs el mes pasado                        │
├───────────────┬──────────────────────────────────────────────┤
│ QUE ESTA      │ EVOLUCION                                    │
│ PASANDO       │ [grafico de linea 6 meses]                   │
│ ✅ Logistica  │                                              │
│ ✅ Stock      │                                              │
│ ⚠️ Pubs       │                                              │
│ ⚠️ Salud      │                                              │
│ 🔴 Publicidad │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

## Jerarquia
- Numero principal mas grande de pantalla: score global o crecimiento de ventas.
- Segundo nivel: estado cualitativo + delta.
- Tercer nivel: resumen por areas con iconos.
- Cuarto nivel: evolucion historica (6 meses).

## Selector de cuenta (multicuenta)
- Visible en header solo si la company tiene mas de una `ml_account`.
- Dropdown compacto con nickname + estado.
- Cambio de cuenta conserva periodo seleccionado.

## Reglas visuales
- CTA primario unico por pantalla: `Ver reporte quincenal`.
- Score siempre acompañado por frase explicativa.
- Tarjetas de estado por area sin numeros tecnicos crudos.
- Fondo claro, cards blancas y bordes suaves para look SaaS premium.

## Estados de pantalla
### Loading
- Skeleton hero de score + checklist + chart.

### Con datos
- Render completo con texto humano.

### Sin diagnostico
- Mensaje: "Aun no tenemos tu primera medicion completa".
- CTA: `Contactar a tu operador`.

### Error
- Mensaje amigable + `Reintentar`.

## Edge cases
- Delta 0: "Tu cuenta se mantuvo estable este mes".
- Delta negativo: mensaje empatico + foco en plan de recuperacion.
- Historial < 6 puntos: mostrar puntos disponibles y leyenda explicativa.
- Todos los frentes en verde: destacar hito positivo mensual.

## Accion principal de la pantalla
`Ver reporte quincenal`.
