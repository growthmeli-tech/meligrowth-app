## Deuda: CSRF robusto para OAuth ML
- **Descripcion**: `state` del callback no esta firmado ni atado a sesion/nonce.
- **Impacto si no se resuelve**: Riesgo de vinculacion indebida de cuentas ML.
- **Esfuerzo estimado**: 8-12 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Cifrado inconsistente de tokens ML
- **Descripcion**: callback puede cifrar, refresh puede guardar plano.
- **Impacto si no se resuelve**: Exposicion de credenciales OAuth en storage.
- **Esfuerzo estimado**: 4-6 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Scraper con mocks en runtime
- **Descripcion**: `mercadolibre.py` devuelve `mock_metrics` incluso en flujo de scraping real.
- **Impacto si no se resuelve**: Decisiones operativas sobre datos ficticios.
- **Esfuerzo estimado**: 16-30 horas (segun cobertura de selectores).
- **Prioridad**: antes del primer cliente real.

## Deuda: No se persiste `data_sources` de pipeline ML
- **Descripcion**: el pipeline arma origen por bloque, pero schema/guardado no lo persiste.
- **Impacto si no se resuelve**: Sin trazabilidad para auditar confiabilidad de cada metrica.
- **Esfuerzo estimado**: 6-10 horas (migration + tipos + lectura UI).
- **Prioridad**: antes del primer cliente real.

## Deuda: Benchmarks y estados desalineados entre capas
- **Descripcion**: scoring, recomendaciones y UX usan umbrales/estados no totalmente consistentes.
- **Impacto si no se resuelve**: Mensajes contradictorios y decisiones erraticas.
- **Esfuerzo estimado**: 10-16 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Dispatch scraping secuencial sin cola con concurrencia
- **Descripcion**: loops secuenciales cliente x bloque en `daily-dispatch`.
- **Impacto si no se resuelve**: Latencia alta y riesgo de backlog en 32/100 cuentas.
- **Esfuerzo estimado**: 12-20 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Duplicacion parser app vs edge function
- **Descripcion**: logica de `process-client-file` duplicada en `supabase/functions/process-file`.
- **Impacto si no se resuelve**: Bugs divergentes y mantenimiento costoso.
- **Esfuerzo estimado**: 8-14 horas.
- **Prioridad**: puede esperar (pero planificar en siguiente ciclo).

## Deuda: Casts peligrosos `as unknown as` en acciones de formularios
- **Descripcion**: multiples binds fuerzan tipos para actions.
- **Impacto si no se resuelve**: Se ocultan errores de contrato entre capas.
- **Esfuerzo estimado**: 4-8 horas.
- **Prioridad**: puede esperar.

## Deuda: Observabilidad de rate limit ML insuficiente
- **Descripcion**: retry de 429 sin metricas/budget explicitos.
- **Impacto si no se resuelve**: Dificil diagnosticar saturacion y planificar crecimiento.
- **Esfuerzo estimado**: 6-12 horas.
- **Prioridad**: antes del primer cliente real.

## Deuda: Vulnerabilidades npm audit (moderadas)
- **Descripcion**: `npm audit` reporta 4 moderadas (`postcss/next/exceljs/uuid` en arbol resuelto).
- **Impacto si no se resuelve**: Riesgo de seguridad de dependencias y ruido en compliance.
- **Esfuerzo estimado**: 2-6 horas para validar y actualizar lockfile/versiones.
- **Prioridad**: puede esperar corto plazo, no largo.
