## Estado de deploy

**Resultado actual: DEPLOY BLOQUEADO**

Bloqueantes principales:
- ❌ `state` OAuth sin proteccion CSRF robusta.
- ❌ Tokens ML pueden quedar en texto plano tras refresh.
- ❌ Scraper fallback devuelve mocks (riesgo de dato no real).
- ❌ Falta trazabilidad persistida de `data_sources` ML.

## SEGURIDAD
- ✅ RLS habilitado en tablas de dominio principales.
- ✅ Bucket `meli-sessions` privado con politicas operator.
- ❌ CSRF OAuth robusto (`state` firmado + nonce + TTL) no implementado.
- ✅ Endpoints internos validan `x-cron-secret`.
- ✅ No se detectaron secrets hardcodeados en app/lib/components.
- ⚠️ `service_role` no se expone en cliente, pero el flujo ML sensible no esta totalmente encapsulado para jobs internos.
- ❌ No hay garantia de cifrado consistente de tokens en storage.

## INTEGRIDAD DE DATOS
- ✅ Pesos de scoring suman 100.
- ❌ Cap inteligente de Salud no coincide con regla esperada.
- ✅ ACOS/ROAS/TACOS matematicamente correctos.
- ❌ Benchmarks no estan alineados entre scoring y recomendaciones.
- ✅ Enums SQL <-> TypeScript estan mayormente sincronizados.
- ⚠️ Hay server actions con `ActionResult<T>`, pero otras acciones usan `redirect` y no contrato uniforme.
- ⚠️ Persistencia de errores es razonable, pero hay writes criticos sin chequeo de error en callback OAuth.

## INTEGRACION ML
- ⚠️ Flujo authorize->callback existe parcialmente; falta hardening de seguridad.
- ✅ Refresh de token con margen (5 min) implementado.
- ✅ Pipeline cubre 5 bloques con fallback.
- ⚠️ Fallback logistica usa bloque scraper `stock` (desalineado).
- ❌ `data_sources` no persiste en diagnostico.
- ❌ Scraper real aun no implementa extraccion real (mock en runtime).
- ❌ `SCRAPER_MOCK_MODE=false` no esta garantizado por defecto.

## PERFORMANCE
- ✅ Dashboard evita `select('*')` en consultas criticas.
- ✅ No N+1 evidente en lectura de diagnosticos del dashboard.
- ✅ Trigger `score_history` existe.
- ✅ Indices principales alineados con queries frecuentes.
- ⚠️ Dispatch scraping secuencial (riesgo en 32/100 cuentas).
- ⚠️ Sin gobernanza observable de rate-limit ML (budget + metricas).

## EXPERIENCIA
- ✅ Redirect de `/` por rol implementado.
- ✅ Mensajes de error en espanol en pantallas principales.
- ✅ Submit loading/deshabilitado en formulario de diagnostico.
- ⚠️ Mapeo de estados/colores no coincide 1:1 con semaforo de 6 estados esperado.
- ⚠️ Delta de score no siempre visible (varios componentes usan `delta=null`).

## INFRAESTRUCTURA
- ⚠️ No existe `lib/config/env.ts` dedicado; validaciones de runtime viven en `lib/supabase/config.ts`.
- ✅ Healthcheck `/api/internal/health` responde con checks y readiness.
- ❌ Falta `docs/testing-cambios.md` y `docs/bugs-encontrados.md` (gap de proceso).
- ❌ No existe `docs/mocks-pendientes.md`.

## Decision final

- **Deploy**: ❌ NO APROBADO
- **Condicion para habilitar deploy**:
  1) Corregir CSRF + cifrado tokens ML.
  2) Eliminar mocks del scraper en entorno productivo.
  3) Persistir trazabilidad de origen de datos ML.
  4) Cerrar gaps de testing/documentacion obligatoria.
