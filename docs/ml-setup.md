# Setup de integracion con Mercado Libre

## 1) Registrar la app en Mercado Libre Developers

1. Entrar a [Mercado Libre Developers](https://developers.mercadolibre.com.ar/).
2. Crear una aplicacion nueva.
3. Configurar el callback OAuth:
   - Produccion: `https://<tu-dominio>/api/ml/auth/callback`
   - Local: `http://localhost:3000/api/ml/auth/callback`
4. Guardar `App ID` y `Client Secret`.

## 2) Variables de entorno

Completar en `.env.local`:

- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `ML_REDIRECT_URI`

Tambien deben estar configuradas las variables del scraper para fallback:

- `SCRAPER_SERVICE_URL`
- `SCRAPER_SERVICE_SECRET`

## 3) Flujo de conexion OAuth

1. El operador redirige al seller a la URL de autorizacion de ML.
2. ML vuelve a `/api/ml/auth/callback` con `code` y `state`.
3. El callback intercambia `code` por `access_token` + `refresh_token`.
4. Los tokens se guardan en Storage (`meli-sessions`), y la sesion se registra en `meli_sessions`.
5. El `seller_id` se sincroniza en `clients.meli_seller_id`.

## 4) Sync de diagnostico

- Endpoint: `POST /api/ml/sync`
- Body: `{ "client_id": "<uuid>" }`
- Respuesta: payload `MLDiagnosticPrefill` con los 5 bloques del diagnostico y `data_sources`.

Si la API oficial falla por bloque, el pipeline intenta fallback via scraper para ese bloque.
