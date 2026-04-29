# MeliGrowth scraper service

FastAPI service invoked by the Next.js app via `POST /jobs/run` with header `x-scraper-secret`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SCRAPER_SERVICE_SECRET` | Yes | Shared secret with the Next.js app (`x-scraper-secret`). |
| `SCRAPER_MOCK_MODE` | No | Default `true`. Set to **`false`** in production so Playwright returns real scraped metrics. |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (storage + tables). |
| `APP_ENCRYPTION_KEY` | Yes when sessions are encrypted | Base64-encoded **32-byte** key used by `decrypt_session_payload()` (AES-256-GCM). Must match the key used by the app when uploading encrypted `session.json` to Storage. |
| `SCRAPER_USER_AGENT` | No | Browser user agent for Playwright contexts (default mimics Chrome on macOS). |
| `SCRAPER_DEBUG_HTML` | No | Set to `true` to write `page.content()` to `/tmp/debug_{tipo}.html` after navigation for selector debugging. |

Do not commit secrets. Configure them in the Railway service dashboard.

## Railway deployment

1. Create a Railway service from this repository (project root = repo root).
2. Use the Dockerfile at `services/scraper/Dockerfile` (see `services/scraper/railway.toml`).
3. Set environment variables above; **`SCRAPER_MOCK_MODE=false`** for production.
4. Ensure Playwright Chromium is available — the Dockerfile runs `playwright install chromium --with-deps`.
5. Expose port **8000** (Railway sets `PORT` in some setups; if you rely on `$PORT`, adjust `CMD` — the provided image uses 8000 per service contract).

Health check: `GET /health`.

## Local run

```bash
cd services/scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
export SCRAPER_SERVICE_SECRET=dev-secret
export SCRAPER_MOCK_MODE=true
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export APP_ENCRYPTION_KEY=...
uvicorn main:app --reload --port 8000
```

## Tests

```bash
cd services/scraper
pip install -r requirements.txt
pytest
```
