# Deploy Live Smoke Test

Guia corta para probar el pipeline real de Mercado Libre en deploy con una cuenta activa.

## Variables necesarias

En la app:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
APP_URL=https://tu-app.vercel.app
APP_ENCRYPTION_KEY=
SCRAPER_SERVICE_URL=https://tu-scraper.fly.dev
SCRAPER_SERVICE_SECRET=
SCRAPER_MOCK_MODE=false
```

En el scraper:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SCRAPER_SERVICE_SECRET=
SCRAPER_MOCK_MODE=false
APP_ENCRYPTION_KEY=
SCRAPER_USER_AGENT=
```

## Preparación de la cuenta

1. Crear o reutilizar un cliente operador en la app.
2. Cargar `Seller ID` y `URL cuenta Mercado Libre`.
3. Exportar el `storage state` JSON desde Playwright para esa cuenta.
4. Subir la sesión en `/operator/clients/[id]/settings`.

## Prueba manual mínima

1. Validar sesión desde configuración del cliente.
2. Confirmar que `meli_sessions.status = validated`.
3. Correr scraping manual de `Salud`.
4. Revisar `scraping_jobs`:
   - `estado = success`
   - `resultado_json` con métricas
5. Repetir con `Publicaciones`, `Ads` y `Stock`.
6. Confirmar que se creó o actualizó un diagnóstico `source = scraping`.

## Prueba del ciclo diario

1. Ir a `/operator/settings`.
2. Ejecutar `Crear y despachar jobs`.
3. Verificar:
   - clientes salteados por falta de sesión
   - jobs creados
   - jobs despachados
   - diagnósticos consolidados

## Qué mirar si falla

- `meli_sessions.last_error`
- `scraping_jobs.error_msg`
- logs del scraper
- auth wall o captcha en Mercado Libre
- `APP_URL` incorrecta en Edge Functions
- `SCRAPER_MOCK_MODE` todavía en `true`
