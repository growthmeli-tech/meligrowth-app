# Panel de Recomendaciones (`/internal/clients/[id]` y `/ops/dashboard`)

## Objetivo
Traducir señal tecnica del motor en acciones claras segun audiencia, con una sola decision visible por card.

## Segmentacion por audiencia
### `manager` (lenguaje ejecutivo)
```text
┌─────────────────────────────────────────────────┐
│ 🔴 URGENTE          Publicidad                 │
│ Tu publicidad esta consumiendo mas de lo       │
│ que genera                                     │
│ Situacion: por cada $1 invertido, generas      │
│ $0.5 — estas perdiendo dinero                  │
│ Impacto estimado: +15 pts si se corrige        │
│ esta semana                                    │
│ [Solicitar accion al operador]                 │
└─────────────────────────────────────────────────┘
```

### `operator` (lenguaje operativo)
```text
┌─────────────────────────────────────────────────┐
│ 🔴 URGENTE · Ads            borde rojo izq      │
│ ACOS 200% — Pausar campanas ahora               │
│ ROAS 0.5x (minimo necesario: 3.33x)             │
│ QUE HACER:                                      │
│ 1. Entrar a Mercado Ads                         │
│ 2. Pausar campanas activas                      │
│ 3. Revisar costos con Joaquin                   │
│ Objetivo: llevar ROAS a >3.33x                  │
│ Impacto: +5 pts en score global                 │
│ [Crear tarea]                                   │
└─────────────────────────────────────────────────┘
```

## Reglas de cards (aplican a ambos perfiles)
- Borde izquierdo con color de prioridad.
- Titulo en lenguaje directo, maximo 1 linea.
- Contexto de situacion y objetivo explicito.
- Impacto visible, nunca oculto en tooltip.
- Exactamente un CTA visible por card.

## Prioridades visuales
- Urgente: rojo (`#DC2626`), pulso suave opcional.
- Alta: naranja (`#EA580C`).
- Media: ambar (`#D97706`).
- Baja: azul (`#2563EB`).

## Estructura de `RecommendationCard`
- Header: prioridad + bloque.
- Body: problema, situacion, que hacer.
- Footer: objetivo + impacto + CTA unico.

## Estados del panel
### Loading
- Skeleton con forma real de 3 cards.

### Con datos
- Orden por prioridad y luego por impacto.

### Sin recomendaciones
- Mensaje: "No hay recomendaciones activas".
- CTA: `Crear accion preventiva`.

### Error
- Error inline + `Reintentar`.

## Edge cases
- Recomendacion duplicada: consolidar por bloque y metrica.
- Recomendacion vencida: badge `Atrasada`.
- Sin impacto cuantitativo: usar impacto cualitativo estandar.
- Accion ya creada: CTA cambia a `Ver tarea`.
