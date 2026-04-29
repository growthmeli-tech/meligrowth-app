# MeliGrowth Platform

Plataforma full-stack para operar y automatizar cuentas de clientes de MeliGrowth en Mercado Libre.

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS
- Supabase/Postgres con RLS
- Motor de scoring modular en `lib/scoring/` (barrel `lib/scoring/index.ts`)
- Motor de acciones automáticas en `lib/actions-engine.ts`
- Parser FastAPI en `services/parser`
- Scraper FastAPI/Playwright en `services/scraper`

## Comandos

```bash
npm install
npm run dev
npm run build
npm run test
npm run test:e2e
npm run audit:console
```

El workspace inicial estaba vacío. Si `npm install` se queda sin red en el sandbox, ejecutarlo localmente en una terminal con acceso a npm.

## Rutas principales

- `/operator/dashboard`
- `/operator/clients/new`
- `/operator/clients/c-1`
- `/operator/clients/c-1/diagnostic/new`
- `/operator/clients/c-1/files`
- `/operator/clients/c-1/settings`
- `/operator/pricing`
- `/client/dashboard`
- `/client/metrics`
- `/client/files`
- `/login`

## Parser

```bash
cd services/parser
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Scraper

```bash
cd services/scraper
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8010
```

## E2E

Playwright usa un servidor Next aislado en `http://127.0.0.1:3100`.

```bash
npm run test:e2e
```

Specs cubiertos:

- login demo y redirección operator
- overview operator y carga de diagnóstico
- dashboard cliente y upload de plantilla
- archivos operador, vista previa normalizada y notificaciones
- evolución histórica, acciones, diagnóstico completo y healthcheck interno

Ver [docs/testing.md](/Users/reset/AUTOMG/docs/testing.md) para correr la suite contra demo o Supabase real.

## Auditoría de consola

Para revisar errores de navegador y requests fallidas con un browser real:

```bash
npx next start --hostname 127.0.0.1 --port 3200
AUDIT_BASE_URL=http://127.0.0.1:3200 npm run audit:console
```

Con Supabase real, agregar en `.env.local` o en la shell:

```bash
AUDIT_OPERATOR_EMAIL=
AUDIT_OPERATOR_PASSWORD=
AUDIT_CLIENT_EMAIL=
AUDIT_CLIENT_PASSWORD=
```

## Operación

- Healthcheck: `GET /api/internal/health` con header `x-cron-secret`.
- Las sesiones sensibles de Mercado Libre deben subirse cifradas con `APP_ENCRYPTION_KEY` compartida entre app y scraper.
- Daily scraping: `POST /api/internal/daily-scraping` con header `x-cron-secret` y body opcional `{ "dispatch": true }`. Cuando `dispatch=true`, además intenta consolidar el diagnóstico del día por cliente.
- Cleanup Edge Function: `cleanup-ops`.
- Daily scraping Edge Function: `daily-scraping`, que proxya al endpoint interno.
- Score alerts Edge Function: `score-alert`, con email opcional vía `RESEND_API_KEY` y `SCORE_ALERT_CC_EMAILS`.
- Las rutas autenticadas están forzadas a render dinámico para evitar cache por usuario.
- La migración incluye índices para consultas frecuentes de dashboard, diagnósticos, archivos, notificaciones y jobs.
- Ver [docs/performance.md](/Users/reset/AUTOMG/docs/performance.md) para criterios de caching y escala.
- Ver [docs/deploy-checklist.md](/Users/reset/AUTOMG/docs/deploy-checklist.md) para el setup operativo de Vercel, scraper, parser y Supabase antes de probar una cuenta real.
- Ver [docs/deploy-live-smoke-test.md](/Users/reset/AUTOMG/docs/deploy-live-smoke-test.md) para probar el pipeline real en deploy con una cuenta activa de Mercado Libre.
