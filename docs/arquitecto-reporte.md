# Sección 1 — Resumen ejecutivo

- La base operativa de Meli Growth funciona: gestión de cuentas, diagnóstico manual en 5 bloques, scoring, acciones y notificaciones (`app/(operator)/**`, `components/diagnostic/diagnostic-form.tsx`, `lib/diagnostics/persist-diagnostic.ts`).
- Hoy el valor inteligente está incompleto: no existe el motor dedicado `lib/recommendations/engine.ts` ni `lib/recommendations/benchmarks.ts`; la lógica actual vive en reglas hardcodeadas (`lib/actions-engine.ts`).
- La integración oficial con Mercado Libre no está implementada en runtime: no existe `lib/ml/**`, ni callback OAuth, ni sync API (`app/api` solo contiene `internal/*`).
- El scraping existe como soporte técnico, pero la extracción principal sigue en modo mock/placeholder en producción lógica (`services/scraper/scrapers/mercadolibre.py`).
- Próximo paso más importante: cerrar la cadena API ML -> diagnóstico -> recomendaciones en una primera versión operativa para una cuenta real.

## Sección 2 — Estado por módulo

| Ruta | Propósito operativo | Conectado a Supabase | Datos de ML | Motor de rec. | Completitud | Gaps críticos |
|---|---|---|---|---|---|---|
| `app/page.tsx` | Entrada app | N/A | No | No | Baja | Redirect fijo a operator |
| `app/(auth)/login/page.tsx` + `actions.ts` | Acceso por rol | Real + fallback demo | No | No | Media | Sin flujo ML/session bootstrap |
| `app/(operator)/operator/dashboard/page.tsx` | Estado cartera y prioridades | Mixto real/mock (`lib/data.ts`) | No | Indirecto (acciones persistidas) | Alta | Riesgo de escala por agregaciones |
| `app/(operator)/operator/clients/new/*` | Onboarding cliente | Real + demo | No | Acciones iniciales básicas | Alta | Control de errores parcial |
| `app/(operator)/operator/clients/[id]/page.tsx` | Vista integral cuenta | Mixto real/mock | No | Sí, vía `actions` | Alta | No consume motor dedicado |
| `app/(operator)/operator/clients/[id]/diagnostic/new/*` | Diagnóstico operativo | Real + demo | No | Sí post-save (acciones) | Alta funcional | Sin prefill ML ni fuente API/manual |
| `app/(operator)/operator/clients/[id]/files/*` | Ingesta planillas | Real + demo | No | No | Alta | Pipeline parser duplicado app/edge |
| `app/(operator)/operator/clients/[id]/settings/*` | Sesión ML/scraping | Real + demo | Parcial (sesión, no API ML) | No | Media-alta | Scraper real incompleto |
| `app/(operator)/operator/pricing/*` | Pricing onboarding | Real + demo | No | No | Alta | Módulo secundario al core operativo |
| `app/(operator)/operator/notifications/page.tsx` | Centro de alertas operator | Mixto real/mock | No | No | Alta | Sin |
| `app/(operator)/operator/settings/*` | Dispatch y checks runtime | Real + demo | No | No | Alta | Dispatch secuencial |
| `app/(client)/client/dashboard/page.tsx` | Estado cliente | Mixto real/mock | No | Muestra acciones derivadas | Alta | Lenguaje aún técnico en partes |
| `app/(client)/client/metrics/page.tsx` | Evolución score | Mixto real/mock | No | No | Alta | Sin trazabilidad de fuente de dato |
| `app/(client)/client/files/*` | Subida planillas cliente | Mixto real/mock | No | No | Alta | Dependencia de parser y estados |
| `app/(client)/client/notifications/page.tsx` | Alertas cliente | Mixto real/mock | No | No | Alta | Sin |
| `app/api/internal/health/route.ts` | Health operativo | Real service role | No | No | Alta | Sin |
| `app/api/internal/daily-scraping/route.ts` | Crear scraping jobs | Real service role | No | No | Alta | No hay capa ML oficial previa |
| `app/api/internal/consolidate-scraping/route.ts` | Consolidar scraping a diagnóstico | Real service role | No | Sí indirecto (persist + acciones) | Alta | Cobertura lógica/logística acoplada |

## Sección 3 — Estado de la cadena completa

Cadena objetivo requerida: API ML -> `lib/ml/pipeline.ts` -> formulario -> diagnóstico -> `engine.ts` -> recomendaciones -> UI.

- API ML: no existe capa runtime (`lib/ml/**` ausente).
- `pipeline.ts`: no existe en `lib/ml/`.
- Formulario diagnóstico: existe y funciona (`components/diagnostic/diagnostic-form.tsx`).
- Guardado diagnóstico: existe y persiste en Supabase (`app/(operator)/operator/clients/[id]/diagnostic/new/actions.ts`, `lib/diagnostics/persist-diagnostic.ts`).
- `engine.ts` de recomendaciones: no existe.
- Recomendaciones/UI: se muestran acciones generadas heurísticamente (`lib/actions-engine.ts`, render en `app/(operator)/operator/clients/[id]/page.tsx`).

Estado del corte: la cadena está cortada en dos puntos bloqueantes:
1) entrada de datos ML (no implementada),
2) motor formal de recomendaciones (no implementado).

## Sección 4 — Estado del Motor de Recomendaciones

- `lib/recommendations/engine.ts`: no existe (gap bloqueante #1).
- `lib/recommendations/benchmarks.ts`: no existe.
- La lógica actual de decisión está en `lib/actions-engine.ts` con umbrales hardcodeados (ej. ACOS vs margen, SKUs sin stock, envíos).
- La conexión post-diagnóstico sí existe, pero hacia acciones y no hacia un motor desacoplado (`lib/diagnostics/persist-diagnostic.ts` invoca `generateActions`).
- En la UI de cuenta se consumen acciones ya guardadas, no un motor de recomendaciones en tiempo real (`app/(operator)/operator/clients/[id]/page.tsx`).
- Conexión Motor <-> Integración ML: no implementada, porque no existe ni el motor dedicado ni la capa ML.

## Sección 5 — Estado de la integración con ML

Análisis `lib/ml/` y `services/scraper/`:

- OAuth oficial ML: no implementado en app (`app/api/ml/auth/callback/route.ts` no existe).
- Variables esperadas (`ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`) no tienen integración visible en runtime de app.
- Pipeline oficial por bloques (salud/publicaciones/ads/logística/stock): no existe (`lib/ml/*` ausente).
- Endpoint de sync al abrir formulario (`/api/ml/sync`): no existe.
- Fallback scraper: existe el servicio Python y la orquestación de jobs (`services/scraper/**`, `lib/scraping/daily-dispatch.ts`, `app/api/internal/daily-scraping/route.ts`), pero la extracción de métricas sigue devolviendo mocks en `scrape_with_page`.
- Pre-fill automático actual del diagnóstico: 0 campos por API oficial; el flujo es manual.

## Sección 6 — Estado del sistema de diagnóstico

- Campos de los 5 bloques: implementados y completos (`components/diagnostic/diagnostic-form.tsx`).
- Zona A (rápida) y Zona B (opcional): implementadas y visualmente diferenciadas (`zone: "rapida" | "opcional"` + `FieldZone`).
- Score por bloque y global en tiempo real: implementado con `useMemo(scoreDiagnostic(buildInput(values)))`.
- Benchmarks inline: parcial; hay hints y warnings de umbral, pero no catálogo central de benchmarks por métrica.
- Ads con 4 inputs base (margen, gasto, ventas ads, ventas totales) + ACOS/ROAS/TACOS: sí, presentes en formulario.
- Fuente de dato por campo (API/manual): no implementada en UI; guardado actual marca `source: "manual"` en la operación.
- Post-guardado con recomendaciones: sí, pero mediante acciones heurísticas automáticas, no motor dedicado.

## Sección 7 — Gaps críticos ordenados por impacto operativo

- [BLOQUEANTE]
  Usuario afectado: Joaquín (análisis/estrategia), Luciano (dirección).
  Descripción: no existe `lib/recommendations/engine.ts` ni `lib/recommendations/benchmarks.ts`.
  Impacto operativo: la capa inteligente no está desacoplada ni trazable; recomendaciones no versionadas por benchmark real.
  Archivo afectado: ausencia en `lib/recommendations/`; lógica actual en `lib/actions-engine.ts`.

- [BLOQUEANTE]
  Usuario afectado: Joaquín, Nacho, Dai.
  Descripción: no existe integración oficial ML (`lib/ml/**`, callback OAuth, sync endpoint).
  Impacto operativo: diagnóstico sigue manual; aumenta tiempo operativo y riesgo de error humano.
  Archivo afectado: ausencia en `lib/ml/` y `app/api/ml/`.

- [CRÍTICO]
  Usuario afectado: equipo operator completo.
  Descripción: scraper con retorno mock en rutas de extracción (`mock_metrics`).
  Impacto operativo: datos potencialmente no reales para decisiones de cuenta.
  Archivo afectado: `services/scraper/scrapers/mercadolibre.py`.

- [CRÍTICO]
  Usuario afectado: Dai (ads) y operación logística.
  Descripción: desacople incompleto entre bloque Logística y modelo de jobs (4 tipos en scraping).
  Impacto operativo: precisión menor en lectura de bloque logístico y priorización de acciones.
  Archivo afectado: `supabase/migrations/0001_initial_schema.sql`, `lib/scraping/daily-dispatch.ts`, `lib/diagnostics/scraping-input.ts`.

- [IMPORTANTE]
  Usuario afectado: QA/Producto/DevOps.
  Descripción: comportamiento mixto real/mock condicionado globalmente por configuración Supabase.
  Impacto operativo: deriva entre ambientes y validaciones difíciles de reproducir.
  Archivo afectado: `lib/supabase/config.ts`, `lib/data.ts`.

- [MENOR]
  Usuario afectado: rol client.
  Descripción: entrada raíz no enruta por sesión/rol.
  Impacto operativo: fricción de experiencia en acceso inicial.
  Archivo afectado: `app/page.tsx`.

## Sección 8 — Gaps de escalabilidad

- [RIESGO EN 10 CUENTAS]
  Descripción técnica: dispatch de scraping por cliente y tipo ejecutado de forma secuencial.
  Impacto proyectado: todavía controlable, pero ya aparece latencia en ventanas operativas.
  Recomendación: instrumentar tiempos por etapa y límites de concurrencia controlada.
  Referencias: `lib/scraping/daily-dispatch.ts`, `app/(operator)/operator/settings/actions.ts`.

- [RIESGO EN 32 CUENTAS]
  Descripción técnica: patrón N x tipos para deduplicar/insertar jobs + consolidación por lazo, con dependencia de red externa.
  Impacto proyectado: backlog diario y resultados tardíos para el equipo operator.
  Recomendación: paralelizar por lotes y definir SLA operacional por cuenta.
  Referencias: `lib/scraping/daily-dispatch.ts`, `lib/diagnostics/consolidate-scraping.ts`.

- [RIESGO EN 100 CUENTAS]
  Descripción técnica: arquitectura actual sin capa ML oficial, scraper parcial y procesamiento principalmente secuencial.
  Impacto proyectado: alto riesgo de timeout, colas largas y pérdida de oportunidad operativa diaria.
  Recomendación: cerrar primero pipeline ML oficial y dejar scraper solo como fallback controlado.
  Referencias: `services/scraper/scrapers/mercadolibre.py`, `supabase/functions/daily-scraping/index.ts`, ausencia en `lib/ml/`.

## Sección 9 — Roadmap para los otros 6 agentes

- Agente ML -> Implementar `lib/ml/{auth,client,endpoints,mappers,pipeline}` + `app/api/ml/auth/callback/route.ts` + endpoint de sync -> Porque elimina carga manual y habilita datos reales desde ML -> Dependencias: contrato de datos definido por Arquitectura y schema de sesiones/tokens.
- Agente Recomendaciones -> Implementar `lib/recommendations/benchmarks.ts` y `lib/recommendations/engine.ts`, conectarlo al guardado de diagnóstico -> Porque convierte métricas en acciones operativas trazables -> Dependencias: contrato de salida del diagnóstico y fuentes de datos.
- Agente Datos/Supabase -> Ajustar modelo para trazabilidad de fuente por métrica/bloque y consistencia logística/stock -> Porque permite auditar confiabilidad del diagnóstico -> Dependencias: definiciones funcionales de ML y motor.
- Agente Scraper -> Transformar scraper en fallback real y no en proveedor principal mock -> Porque protege operación cuando API ML falla -> Dependencias: pipeline ML oficial y mapping de campos.
- Agente UI/UX -> Exponer en formulario fuente API/manual, delta y feedback post-guardado de recomendaciones -> Porque reduce tiempo de interpretación del operador y mejora confianza -> Dependencias: salida estable del motor y pipeline.
- Agente Testing -> Cobertura e2e de cadena completa (ML sync -> diagnóstico -> recomendaciones -> acciones), con escenarios real/fallback -> Porque evita regresiones en el flujo más crítico del producto -> Dependencias: avances de ML, recomendaciones y scraper.

## Sección 10 — Oportunidades de mejora proactivas

- Mostrar en diagnóstico un badge por campo (`API`, `Manual`, `Scraper`) para priorizar revisión humana donde la fuente sea menos confiable.
- Incorporar delta por métrica vs diagnóstico anterior dentro del mismo formulario para acelerar decisiones de rescate/escalado.
- Agregar vista de recomendaciones por bloque (Salud/Publicaciones/Ads/Logística/Stock) para que cada operador vea su área sin ruido.
- Permitir estado operativo de recomendación (`pendiente`, `en curso`, `resuelta`) con trazabilidad temporal por cuenta.
- Exponer “última actualización de datos ML” por cuenta en dashboard operator para detectar cuentas desactualizadas antes del comité diario.
- Incluir alerta preventiva cuando una cuenta supere X días sin sync válido para evitar diagnósticos basados en información vieja.

## Sección 11 — Archivos que NO tocar

- `supabase/migrations/0001_initial_schema.sql` -> Base sólida del dominio (tablas, políticas, índices, triggers) alineada a la operación actual.
- `supabase/migrations/0002_pricing_proposals.sql` -> Extiende pricing sin romper núcleo operativo de diagnóstico.
- `supabase/migrations/0003_meli_sessions.sql` -> Modelo de sesiones/jobs correcto para soportar integración futura ML/scraper.
- `lib/supabase/server.ts` -> Cliente server bien encapsulado y reusable.
- `lib/supabase/service.ts` -> Frontera clara para service role y tareas internas.
- `lib/supabase/browser.ts` -> Wrapper simple y estable para cliente browser.
- `components/ui/button.tsx` -> Primitivo de UI estable y transversal.
- `components/ui/card.tsx` -> Primitivo de layout consistente en toda la app.
- `components/ui/badge.tsx` -> Primitivo visual reutilizable sin deuda funcional.

## Sección 12 — Preguntas abiertas

- ¿Se prioriza primero integración oficial ML (OAuth + pipeline) o robustecimiento del scraper fallback, sabiendo que hoy ambos están incompletos?
- ¿El bloque Logística debe tener tipo de scraping propio en modelo de datos o seguirá acoplado al flujo de `stock`?
- ¿Cuál es el SLA objetivo de actualización por cuenta (diario, intra-diario) para definir límites de concurrencia y alertas operativas?
- ¿El motor de recomendaciones debe reemplazar completamente `lib/actions-engine.ts` o convivir temporalmente como adaptador de salida?
- ¿Qué porcentaje mínimo de campos prellenados por API ML se considera “go-live” para operar la primera cuenta con baja carga manual?
