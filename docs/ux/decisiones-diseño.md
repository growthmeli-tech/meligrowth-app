# Decisiones de Diseno (sin spec explicita)

## 1. Separador por plan en tabla interna
Se definio un separador visual entre cuentas `360°` y `Copilot` para acelerar lectura operativa en cartera extensa.

## 2. CTA unico por recomendacion
Se estandarizo "un CTA visible por card" para cumplir regla de foco y evitar ambiguedad en ejecucion.

## 3. Header multicuenta en `/brand/dashboard`
Cuando una company tenga multiples `ml_accounts`, se agrega selector en header para mantener una sola vista gerencial coherente.

## 4. Estructura de tabs en vista de cuenta
Se dejo `Diagnostico`, `Historial`, `Archivos` y `Config` como profundidad secundaria, manteniendo recomendaciones fuera de tabs.

## 5. Priorizacion visual en `/ops/dashboard`
Se eligio mostrar solo top 3 prioridades en primer viewport y derivar el resto a "Ver todas" para asegurar accion inmediata en mobile.

## 6. Uso de tipografia mono en metricas
Se explicita `font-mono` para valores numericos en recomendaciones y diagnostico para mejorar comparabilidad y precision visual.

## 7. Estados sin datos de Ads
Se resolvio mostrar bloque Ads como "Sin datos" sin romper layout ni penalizar visualmente, respetando comportamiento de exclusion de peso.

## 8. Skeletons por forma real
Se fijo criterio de skeleton estructural por pantalla para mantener percepcion premium y evitar "spinner sin contexto".

## 9. Accion principal por vista
Se establecio una accion principal por pantalla:
- `/internal/dashboard`: `Ver cuenta`.
- `/internal/clients/[id]`: `Crear tarea`.
- `/internal/clients/[id]/diagnostic/new`: `Guardar diagnostico`.
- `/brand/dashboard`: `Ver reporte quincenal`.
- `/ops/dashboard`: `Resolver prioridad #1`.

## 10. Mapeo operativo de copy
Se definio copy operativo para internal/ops y copy ejecutivo para brand, evitando mezcla de tono entre audiencias.

## 11. Estandar de estados por componente
Se definio que todos los componentes documenten explicitamente `default`, `hover`, `active`, `loading`, `empty` y `error`. En componentes donde no aplica `empty` o `active`, se especifica fallback para evitar ambiguedad de implementacion.

## 12. Jerarquia visual canonica
Se establecio como regla transversal que el score o la accion principal siempre sea dominante, y que metadata/fechas queden en nivel terciario (`text-xs text-[#6B6B6B]`).

## 13. Reglas de motion compartidas
Se unifico motion UI:
- hover de cards: `duration-200`
- microinteracciones de lista: `duration-150`
- count-up de score hero: `800ms ease-out`
- banners urgentes: pulso continuo

## 14. Definicion de breakpoints operativos
Se adopto comportamiento fijo:
- mobile: compresion vertical, CTAs apilados, scroll horizontal en chips
- desktop: CTAs en linea, grillas estables y filas completas

## 15. RecommendationCard con dos CTAs solo en operator
Para resolver la tension entre foco y operacion, se dejo:
- manager: 1 CTA unico
- operator: CTA principal + accion secundaria de higiene (`Marcar vista`)

## 16. Chart sin eje Y visible
Se oculto eje Y para reducir ruido visual y apoyar lectura de tendencia via tooltip, manteniendo semaforo del ultimo punto como ancla cognitiva.

## 17. EmptyState con copy cerrado por contexto
Se fijaron textos exactos por contexto (`diagnosticos`, `tareas`, `clientes`, `recomendaciones`) para que UI no improvise contenido inconsistente en produccion.
