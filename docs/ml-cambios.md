# Cambios de integracion ML

## Archivos creados

- `lib/ml/auth.ts`: OAuth (`authorization`, `exchange`, `refresh`) y obtencion de token valido desde `meli_sessions`.
- `lib/ml/client.ts`: cliente HTTP de ML con retries, manejo de `429` y errores de auth/API.
- `lib/ml/endpoints/reputation.ts`: bloque 01 (salud).
- `lib/ml/endpoints/listings.ts`: bloque 02 (publicaciones y performance).
- `lib/ml/endpoints/ads.ts`: bloque 03 (Mercado Ads).
- `lib/ml/endpoints/logistics.ts`: bloque 04 (ordenes, incidencias y full/flex).
- `lib/ml/endpoints/stock.ts`: bloque 05 (stock y SKUs sin stock).
- `lib/ml/mappers/types.ts`: tipos compartidos de API y contrato de prefill.
- `lib/ml/mappers/to-diagnostic.ts`: mapeo de metricas del scraper al contrato de diagnostico.
- `lib/ml/pipeline.ts`: orquestacion completa de los 5 bloques + fallback scraper por bloque.
- `lib/ml/index.ts`: exports del modulo ML.
- `app/api/ml/auth/callback/route.ts`: callback OAuth para conectar cuentas.
- `app/api/ml/sync/route.ts`: sync manual para prefill del diagnostico.
- `docs/ml-setup.md`: guia operativa de setup y conexion.

## Archivos modificados

- `.env.example`: nuevas variables `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`.
- `lib/supabase/config.ts`: checks de runtime para variables de ML y `mlReady`.

## Resultado

La app ya puede:

1. autorizar cuentas de Mercado Libre via OAuth,
2. refrescar tokens automaticamente,
3. consultar los 5 bloques del diagnostico con la API oficial,
4. aplicar fallback al scraper cuando falla un bloque,
5. exponer los datos sincronizados mediante `POST /api/ml/sync`.
