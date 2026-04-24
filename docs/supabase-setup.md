# Supabase Setup

## Variables necesarias

Copiar estos valores desde Supabase Project Settings > API:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Para este primer paso solo hacen falta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Checklist operativo:

- `/operator/settings` muestra qué variables están presentes sin exponer secretos.
- `/api/internal/health` devuelve estado de Supabase, parser, scraper, email y readiness general.
- `SUPABASE_SERVICE_ROLE_KEY` habilita jobs internos; `PARSER_SERVICE_URL` + `PARSER_SERVICE_SECRET` habilitan procesamiento automático de archivos.
- `SCRAPER_SERVICE_URL` + `SCRAPER_SERVICE_SECRET` habilitan scraping automatizado.
- `RESEND_API_KEY` + `REPORT_FROM_EMAIL` habilitan emails de reportes y alertas.

## Migración

Ejecutar `supabase/migrations/0001_initial_schema.sql` en el SQL editor o con Supabase CLI.

La migración crea:

- `public.users` vinculado a `auth.users`
- `public.clients` con `operator_id` y `client_user_id`
- tablas de diagnósticos, historial, acciones, archivos, scraping jobs y notificaciones
- bucket privado `client-files` en Supabase Storage
- RLS para operador asignado y cliente propio
- políticas de Storage para que cada cliente vea/suba solo archivos de su cuenta
- trigger `on_auth_user_created` para crear el perfil al registrar usuarios
- trigger `on_diagnostic_insert_score_history` para crear historial al guardar diagnósticos

## Usuarios de prueba

Crear los usuarios desde Supabase Auth con metadata:

Operador:

```json
{
  "name": "Luciano",
  "role": "operator"
}
```

Cliente:

```json
{
  "name": "Tienda Pampa",
  "role": "client"
}
```

Después de crearlos, vincular el cliente:

```sql
insert into public.clients (
  name,
  initials,
  plan,
  operator_id,
  client_user_id,
  meli_account_url,
  meli_seller_id
) values (
  'Tienda Pampa',
  'TP',
  'growth',
  '<OPERATOR_USER_ID>',
  '<CLIENT_USER_ID>',
  'https://www.mercadolibre.com.ar/perfil/TIENDA-PAMPA',
  '1849201'
);
```

Para que el dashboard muestre datos reales, cargar al menos un registro en `diagnostics` para ese `client_id`.

## Upload de archivos

El flujo `/client/files` sube archivos al bucket privado `client-files` y crea un registro en `public.client_files`.
Si `SUPABASE_SERVICE_ROLE_KEY`, `PARSER_SERVICE_URL` y `PARSER_SERVICE_SECRET` están configuradas, el archivo se procesa automáticamente después del upload.

Formatos permitidos:

- `.csv`
- `.xlsx`
- `.ods`

Límite por archivo: 10 MB.

La ruta del objeto en Storage usa este formato:

```txt
<CLIENT_ID>/<timestamp>-<filename>
```

Para probar:

1. Iniciar sesión como usuario con `role = client`.
2. Entrar a `/client/files`.
3. Subir una planilla CSV/XLSX/ODS.
4. Verificar que aparezca como `Pendiente` en el historial.
5. En Supabase Storage, verificar que el archivo exista en el bucket `client-files`.

## Parser automático

Variables necesarias:

```env
SUPABASE_SERVICE_ROLE_KEY=
PARSER_SERVICE_URL=
PARSER_SERVICE_SECRET=
CRON_SECRET=
REPORT_FROM_EMAIL=
```

Servidor local del parser:

```bash
cd services/parser
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PARSER_SERVICE_SECRET=dev-secret uvicorn main:app --reload --port 8000
```

En `.env.local` de Next:

```env
PARSER_SERVICE_URL=http://localhost:8000
PARSER_SERVICE_SECRET=dev-secret
```

El procesamiento hace:

1. Descarga el archivo privado desde Storage con service role.
2. Envía el archivo al endpoint `POST /parse` del parser.
3. Detecta tipo de plantilla por headers.
4. Normaliza filas en tablas de dominio:
   - `products`
   - `margins`
   - `product_specs`
5. Actualiza `client_files.procesado`, `procesado_at`, `tipo` y `error_procesamiento`.
6. Crea una notificación para el operador asignado.

Headers mínimos por plantilla:

```txt
skus_stock: sku, stock
margenes: sku, costo, precio, margen
ficha_tecnica: sku, titulo, descripcion
```

Las columnas extra de `ficha_tecnica` se guardan en `product_specs.attributes`.
La normalización hace upsert por `(client_id, sku)`, por lo que subir una plantilla nueva actualiza SKUs existentes sin duplicarlos.

La Edge Function `supabase/functions/process-file` permite reprocesar por `file_id` desde cron o jobs internos:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/process-file" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"file_id":"<CLIENT_FILE_ID>"}'
```

## Notificaciones in-app

Las rutas disponibles son:

- `/operator/notifications`
- `/client/notifications`

La campana del header muestra el contador de `notifications.leida = false` para el usuario logueado.

RLS:

- cada usuario solo lee sus propias notificaciones (`notifications.user_id = auth.uid()`)
- cada usuario solo puede marcar como leídas sus propias notificaciones

Eventos que ya crean notificaciones:

- archivo procesado correctamente
- error al procesar archivo
- error al normalizar datos parseados
- caída de score global de 10+ puntos
- bloque de score en estado crítico
- cuenta con score global crítico
- diagnóstico desactualizado por más de 7 días desde Edge Function

Acciones disponibles:

- marcar una notificación como leída
- marcar todas como leídas

## Alertas de degradación

Al guardar un diagnóstico manual, la Server Action compara contra el diagnóstico anterior del cliente y crea notificaciones para el operador asignado cuando:

- `score_global` cae 10 puntos o más
- cualquier bloque queda por debajo de 55
- el score global queda por debajo de 55

Además, si `RESEND_API_KEY` está configurado, envía un email best-effort al operador asignado. Para copiar a Luciano u otra casilla operativa, configurar:

```env
SCORE_ALERT_FROM_EMAIL="MeliGrowth <alerts@tu-dominio.com>"
SCORE_ALERT_CC_EMAILS="luciano@tu-dominio.com,ops@tu-dominio.com"
```

La Edge Function `supabase/functions/score-alert` permite correr el monitoreo por cron para detectar diagnósticos viejos y degradaciones recientes:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/score-alert" \
  -H "x-cron-secret: $CRON_SECRET"
```

La función deduplica alertas por día usando `client_id`, `user_id` y `titulo`.

## Reporte semanal automático

La Edge Function `supabase/functions/weekly-report` envía un resumen semanal al email del usuario cliente vinculado a cada cuenta activa.

Variables necesarias:

```env
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CRON_SECRET=
REPORT_FROM_EMAIL="MeliGrowth <reports@tu-dominio.com>"
SCRAPER_SERVICE_URL=
SCRAPER_SERVICE_SECRET=
SCRAPER_MOCK_MODE=true
```

La función hace:

1. Busca clientes activos con `client_user_id`.
2. Obtiene el email desde `public.users`.
3. Toma los últimos 2 diagnósticos para calcular variación semanal.
4. Incluye las 3 acciones abiertas principales.
5. Genera un PDF simple del resumen.
6. Envía email vía Resend con el PDF adjunto en Base64.
7. Registra el resultado en `weekly_reports`.
8. Crea una notificación `reporte_semanal` para el cliente.

Ejemplo de ejecución manual:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/weekly-report" \
  -H "x-cron-secret: $CRON_SECRET"
```

Cron sugerido: lunes 9:00 AM hora local de operación.

## Scraping automatizado

La infraestructura inicial de scraping incluye:

- Edge Function `supabase/functions/daily-scraping`
- microservicio FastAPI en `services/scraper`
- tabla `scraping_jobs`
- bucket privado `meli-sessions` para sesiones Playwright guardadas
- vista de jobs recientes en `/operator/settings`

Variables necesarias:

```env
SUPABASE_SERVICE_ROLE_KEY=
SCRAPER_SERVICE_URL=http://localhost:8010
SCRAPER_SERVICE_SECRET=dev-scraper-secret
SCRAPER_MOCK_MODE=true
MELI_SESSION_DIR=sessions
APP_URL=http://localhost:3000
CRON_SECRET=
```

Servidor local:

```bash
cd services/scraper
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
SCRAPER_SERVICE_SECRET=dev-scraper-secret \
NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
uvicorn main:app --reload --port 8010
```

Ejecución diaria:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/daily-scraping" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"dispatch":true}'
```

Comportamiento:

1. Crea jobs diarios por cliente activo para `salud`, `ads`, `publicaciones` y `stock`.
2. Evita duplicar jobs del mismo tipo para el mismo cliente en el mismo día.
3. Si `dispatch=true`, llama al microservicio scraper.
4. El scraper marca el job como `running`, `success` o `error`.
5. El resultado queda en `scraping_jobs.resultado_json`.

Consolidación a diagnóstico:

```bash
curl -X POST "$APP_URL/api/internal/consolidate-scraping" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{}'
```

O vía Edge Function:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/consolidate-scraping" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{}'
```

También se puede consolidar un cliente específico:

```bash
curl -X POST "$APP_URL/api/internal/consolidate-scraping" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"client_id":"<CLIENT_ID>"}'
```

La consolidación:

1. Toma los últimos jobs exitosos del día por cliente.
2. Requiere `salud`, `publicaciones`, `ads` y `stock`.
3. Normaliza `resultado_json.metrics` a `DiagnosticInput`.
4. Calcula score con el mismo motor que la carga manual.
5. Inserta `diagnostics.source = 'scraping'`.
6. Genera `score_history`, acciones automáticas y alertas de degradación.
7. Evita crear más de un diagnóstico scraping por cliente por día.

Orden de cron recomendado:

1. 07:00 ejecutar `daily-scraping` con `dispatch=true`.
2. 07:30 ejecutar `consolidate-scraping`.
3. 07:40 ejecutar `score-alert`.
4. 08:00 ejecutar `cleanup-ops`.

## Healthcheck y limpieza operativa

Healthcheck interno de la app:

```bash
curl "$APP_URL/api/internal/health" \
  -H "x-cron-secret: $CRON_SECRET"
```

Devuelve estado de configuración de Supabase, parser, scraper, Resend y conexión a base.

Limpieza operativa:

```bash
curl -X POST "$SUPABASE_FUNCTION_URL/cleanup-ops" \
  -H "x-cron-secret: $CRON_SECRET"
```

Hace:

- marca como `error` los scraping jobs `running` con más de 2 horas
- elimina notificaciones leídas con más de 90 días

## Performance y caching

Las rutas autenticadas de operator, client y login fuerzan render dinámico y `revalidate = 0` para evitar cachear HTML con datos de usuario.

Las consultas frecuentes tienen índices en:

- `clients(operator_id, active)`
- `clients(client_user_id)`
- `diagnostics(client_id, date desc, created_at desc)`
- `score_history(client_id, date)`
- `actions(client_id, estado, prioridad)`
- `client_files(client_id, created_at desc)`
- `notifications(user_id, leida, created_at desc)`
- `scraping_jobs(client_id, tipo, created_at desc)`
- `weekly_reports(client_id, created_at desc)`

Las llamadas internas a parser, scraper, Resend y consolidación tienen timeout explícito para evitar procesos colgados.

Sesiones Playwright:

- En mock mode no se necesitan sesiones.
- En modo real, guardar storage state en `services/scraper/sessions/<MELI_SELLER_ID>.json`.
- El bucket `meli-sessions` queda creado para almacenar sesiones de forma privada si se automatiza la sincronización.

Nota operativa: los selectores reales de Mercado Libre deben versionarse y monitorearse. El servicio ya está preparado para sesiones guardadas, user-agent configurable y detección básica de auth wall/CAPTCHA.
