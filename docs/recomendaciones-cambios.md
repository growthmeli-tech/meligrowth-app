# Motor de recomendaciones - cambios implementados

## Alcance

Se implemento un motor de recomendaciones completo en paralelo a `lib/actions-engine.ts` (sin reemplazarlo), con generacion en tiempo real post-diagnostico y capa de consultas para consumo desde server actions.

## Archivos creados

- `lib/recommendations/types.ts`: contratos tipados para recomendaciones, analisis de ads y prioridades.
- `lib/recommendations/benchmarks.ts`: benchmarks por bloque/metrica y helpers de objetivo.
- `lib/recommendations/actions.ts`: matriz de acciones concretas por metrica y estado.
- `lib/recommendations/priorities.ts`: reglas de prioridad y ordenamiento.
- `lib/recommendations/ads-analyzer.ts`: calculos ACOS/ROAS/TACOS y estado de salud ads.
- `lib/recommendations/score-interpreter.ts`: interpretacion de score global y estrategia general.
- `lib/recommendations/engine.ts`: orquestador principal de recomendaciones.
- `lib/recommendations/pipeline.ts`: helper de pipeline para combinar diagnostico y recomendaciones.
- `lib/recommendations/index.ts`: barrel de exportaciones.
- `lib/data/recommendations.ts`: queries para recomendaciones por cliente, por diagnostico y urgentes por operador.
- `lib/types/api.ts`: tipo `ActionResult<T>`.
- `lib/utils/errors.ts`: helper central para logging de errores server.
- `tests/unit/lib/recommendations/engine.test.ts`: pruebas unitarias del motor y del analizador de ads.

## Integraciones realizadas

- `app/(operator)/operator/clients/[id]/diagnostic/new/actions.ts`:
  - Integra `generateRecommendations`.
  - Retorna `ActionResult<{ diagnostic, recommendations }>` tras guardar.
  - Mantiene las revalidaciones existentes.
- `lib/diagnostics/persist-diagnostic.ts`:
  - Inserta diagnostico con `select("*")` para recuperar la fila guardada.
  - Expone `diagnostic` en la respuesta para habilitar la generacion inmediata de recomendaciones.
- `components/diagnostic/diagnostic-form.tsx`:
  - Ajusta el tipo del `action` para aceptar respuestas de server action.

## Como usar

- Guardado manual de diagnostico:
  - Invocar `createDiagnostic(clientId, formData)`.
  - Si `success: true`, la respuesta trae `data.diagnostic` y `data.recommendations`.
- Lectura directa:
  - `getClientRecommendations(clientId)` para ultimo diagnostico.
  - `getRecommendationsForDiagnostic(diagnosticId)` para un diagnostico puntual.
  - `getUrgentRecommendationsForOperator(operatorId)` para panel de alertas.

## Compatibilidad

- `lib/actions-engine.ts` y el flujo de persistencia de acciones quedan vigentes.
- El nuevo motor se suma como capa inteligente adicional y no modifica el esquema SQL.
