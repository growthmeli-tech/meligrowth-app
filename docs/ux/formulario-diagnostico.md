# Formulario de Diagnóstico (`/operator/clients/[id]/diagnostic/new`)

## Objetivo de la pantalla
Permitir cargar un diagnóstico completo en menos de 10 minutos, con feedback inmediato de benchmark, score en tiempo real y claridad sobre fuente de cada dato (ML, scraper o manual).

## Usuario principal
- Joaquín (uso intensivo, análisis técnico)

## Flujo esperado
1. Abrir formulario con prefill automático disponible.
2. Completar Zona A (rápida) por bloque.
3. Ver benchmark inline y score actualizándose en tiempo real.
4. Completar Zona B opcional si hay más datos.
5. Guardar y ver resultado inmediato con recomendaciones generadas.

## Wireframe (edición)
```text
┌────────────────────────────────────────────────────────────┐
│ Cliente X                        Nuevo diagnóstico          │
│ Fuente global: API ML + Manual                            │
├────────────────────────────────────────────────────────────┤
│ Tabs bloque: Salud | Publicaciones | Ads | Logística | Stock
├────────────────────────────────────────────────────────────┤
│ 01 Salud                                     Score [67] 🟡  │
│ Zona A (rápida)                                           │
│ Reclamos %                                                │
│ [ 0.6 ] %   [Badge: ML/API]                               │
│ 🟡 En desarrollo                                           │
│ Benchmark: <0.5 sólido · >1 crítico                       │
│ Objetivo sugerido: bajar a <0.5%                          │
│                                                            │
│ Zona B (opcional) [colapsada/expandible]                  │
├────────────────────────────────────────────────────────────┤
│ PREVIEW                                                    │
│ Score global [77] Sólido ↑+5                              │
│ Barras por bloque + warnings + calidad de datos           │
│ [Guardar diagnóstico]                                      │
└────────────────────────────────────────────────────────────┘
```

## Wireframe (post-submit)
```text
┌────────────────────────────────────────────┐
│ ✅ Diagnóstico guardado                    │
│ SCORE FINAL: 77  Sólido  ↑+5              │
│                                            │
│ Recomendaciones generadas (3)              │
│ 🔴 Envíos a tiempo (impacto +8)            │
│ 🟠 ACOS vs margen (impacto +6)             │
│ 🟡 Catálogo (impacto +3)                   │
│                                            │
│ [Ver cuenta completa]                      │
│ [Generar reporte quincenal]                │
└────────────────────────────────────────────┘
```

## Diseño de campos con benchmark inline

### `DiagnosticFieldWithBenchmark` (componente obligatorio)
- Estructura por campo:
  - label de métrica,
  - input numérico,
  - badge de fuente (`ML API`, `Scraper`, `Manual`),
  - estado semáforo textual,
  - benchmark corto,
  - objetivo accionable.
- Feedback inmediato al tipear (sin submit).
- Si el valor rompe umbral crítico, mostrar alerta compacta bajo el campo.

## Score en tiempo real
- Recalcular:
  - score del bloque activo,
  - score global,
  - estado global y por bloque,
  - warnings de coherencia.
- Frecuencia: en cada cambio de input, con debounce suave (150-250ms).
- Visualización:
  - score numérico + barra de progreso + estado textual.

## Badge de fuente de datos ML
- Tipos permitidos:
  - `ML API` (verde claro),
  - `Scraper` (ámbar),
  - `Manual` (gris).
- Se muestra junto al input y en tooltip explicativo.
- Si un bloque tiene mezcla de fuentes, mostrar resumen en cabecera del bloque.

## Reglas UX por zona
- Zona A visible por defecto.
- Zona B colapsada por defecto para acelerar carga.
- Cambiar de bloque mantiene valores temporales ya ingresados.
- Nunca ocultar preview global ni botón de guardar.

## Estados de la pantalla

### Cargando
- Skeleton de tabs, 4 campos y preview lateral.

### Con datos prefill
- Valores iniciales + badges de fuente.

### Sin prefill
- Todos los badges en `Manual`.
- Mensaje informativo: "Sin sync reciente de ML para esta cuenta."

### Error de guardado
- Banner rojo con motivo técnico traducido.
- Mantener valores cargados en memoria.

### Éxito de guardado
- No redirigir automáticamente al listado.
- Mostrar pantalla de resultado con recomendaciones.

## Edge cases
- Porcentajes >100 o <0: validación inline inmediata.
- Inconsistencia ads (`gasto_ads` alto y `ventas_ads` cero): warning crítico.
- Pérdida de conexión al guardar: guardar borrador local temporal.
- Usuario cierra pestaña con cambios sin guardar: confirmación de salida.
- Bloque no disponible por falta de datos ML: fallback a carga manual guiada.

## Contenido de ayuda contextual
- Microcopy orientado a decisión, no teoría.
- Ejemplo: "ACOS ideal: menor al 36% del margen pre ads."

## KPIs UX
- Tiempo medio de carga completa: < 10 minutos.
- Porcentaje de campos con fuente no manual en cuentas conectadas: > 60%.
- Error rate de validación por campo: < 5%.
