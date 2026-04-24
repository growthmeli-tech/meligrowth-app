# Deploy Checklist

Checklist operativo para dejar MeliGrowth listo en deploy antes de probar una cuenta real de Mercado Libre.

## 1. App web

Deploy sugerido: Vercel.

Variables mínimas:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
APP_URL=https://tu-app.vercel.app
APP_ENCRYPTION_KEY=
PARSER_SERVICE_URL=
PARSER_SERVICE_SECRET=
SCRAPER_SERVICE_URL=
SCRAPER_SERVICE_SECRET=
SCRAPER_MOCK_MODE=false
RESEND_API_KEY=
REPORT_FROM_EMAIL=
SCORE_ALERT_FROM_EMAIL=
SCORE_ALERT_CC_EMAILS=
```

Checks:

1. `APP_URL` debe apuntar al deploy real.
2. `SCRAPER_MOCK_MODE=false` si querés navegación real.
3. `CRON_SECRET` debe coincidir entre app y Edge Functions.
4. `APP_ENCRYPTION_KEY` debe existir para cifrar sesiones sensibles.

## 2. Scraper

Deploy sugerido: Fly.io o Railway.

Variables mínimas:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SCRAPER_SERVICE_SECRET=
SCRAPER_MOCK_MODE=false
APP_ENCRYPTION_KEY=
SCRAPER_USER_AGENT=
```

Checks:

1. Exponer `/health`.
2. Exponer `/jobs/run`.
3. Exponer `/session/validate`.
4. Verificar que el servicio tenga Playwright Chromium instalado.
5. Confirmar que puede descifrar sesiones con `APP_ENCRYPTION_KEY`.

## 3. Parser

Deploy sugerido: Railway o Fly.io.

Variables mínimas:

```env
PARSER_SERVICE_SECRET=
```

Checks:

1. Exponer `/parse`.
2. Aceptar `.csv`, `.xlsx` y `.ods`.

## 4. Supabase

### Base y auth

1. Correr migraciones:
   - `0001_initial_schema.sql`
   - `0002_pricing_proposals.sql`
   - `0003_meli_sessions.sql`
2. Confirmar usuarios `operator` y `client` en `auth.users`.
3. Confirmar filas en `public.users`.

### Storage

Buckets esperados:

1. `client-files`
2. `meli-sessions`

### Edge Functions

Deployar:

1. `process-file`
2. `daily-scraping`
3. `consolidate-scraping`
4. `score-alert`
5. `weekly-report`
6. `cleanup-ops`

Variables compartidas en Supabase Functions:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
APP_URL=
APP_ENCRYPTION_KEY=
PARSER_SERVICE_URL=
PARSER_SERVICE_SECRET=
SCRAPER_SERVICE_URL=
SCRAPER_SERVICE_SECRET=
RESEND_API_KEY=
REPORT_FROM_EMAIL=
SCORE_ALERT_FROM_EMAIL=
SCORE_ALERT_CC_EMAILS=
```

## 5. Verificación técnica mínima

1. `GET /api/internal/health` con `x-cron-secret`
2. `/operator/settings` debe mostrar:
   - Core Supabase listo
   - Scraper listo
   - `APP_URL` presente
   - `APP_ENCRYPTION_KEY` presente
   - `SCRAPER_MOCK_MODE=false`
3. `SCRAPER_SERVICE_URL/health` debe responder `{ ok: true }`

## 6. Prueba operativa mínima

1. Crear o editar cliente real.
2. Cargar `seller_id` y `meli_account_url`.
3. Subir sesión JSON.
4. Validar sesión.
5. Correr scraping manual de `Salud`.
6. Revisar `scraping_jobs`.
7. Correr dispatch diario.
8. Confirmar consolidación en `diagnostics`.

## 7. Qué mirar si algo falla

1. `meli_sessions.last_error`
2. `scraping_jobs.error_msg`
3. logs del scraper
4. `APP_URL` mal configurada
5. `SCRAPER_MOCK_MODE=true`
6. `APP_ENCRYPTION_KEY` faltante o distinta entre app y scraper
7. bucket `meli-sessions` sin acceso o vacío
8. captcha o auth wall de Mercado Libre
