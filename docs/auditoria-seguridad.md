## Hallazgo: OAuth callback con `state` debil (riesgo CSRF)
- **Nivel**: CRITICO
- **Archivo**: `app/api/ml/auth/callback/route.ts`
- **Descripcion**: El callback usa `state` como `client_id` directo y solo valida existencia del cliente. No hay nonce firmado, expiracion ni vinculacion a sesion del operador. Un actor con un `code` valido podria intentar vincular tokens a otro cliente.
- **Fix recomendado**: Generar `state` firmado (HMAC) con `client_id`, `operator_id`, `ts` y nonce; persistir nonce temporal; validar firma/TTL/owner en callback antes de guardar tokens.
- **Estado**: PENDIENTE

## Hallazgo: Tokens OAuth quedan en texto plano despues de refresh
- **Nivel**: CRITICO
- **Archivo**: `lib/ml/auth.ts`, `app/api/ml/auth/callback/route.ts`
- **Descripcion**: El callback cifra tokens solo si `APP_ENCRYPTION_KEY` existe, pero `saveSessionTokens()` reescribe siempre JSON plano. Resultado: una sesion inicialmente cifrada puede pasar a texto plano cuando refresca token.
- **Fix recomendado**: Unificar escritura en una sola capa que siempre cifre (si no hay clave, fallar duro). Agregar test de roundtrip callback -> refresh -> read.
- **Estado**: PENDIENTE

## Hallazgo: Uso de `createServiceSupabaseClient` no alineado al flujo ML sensible
- **Nivel**: ALTO
- **Archivo**: `lib/ml/auth.ts`
- **Descripcion**: El flujo de lectura/escritura de `meli_sessions` y bucket `meli-sessions` usa cliente server de usuario, no cliente service para tareas internas. Puede fallar en jobs internos sin sesion y mezcla responsabilidades de seguridad.
- **Fix recomendado**: Encapsular acceso sensible en helper interno con `createServiceSupabaseClient` y controles explicitos de ownership/client_id.
- **Estado**: PENDIENTE

## Hallazgo: Actualizaciones criticas sin control de error
- **Nivel**: ALTO
- **Archivo**: `app/api/ml/auth/callback/route.ts`
- **Descripcion**: Los `upsert`/`update` de `meli_sessions` y `clients` no chequean `error`; el callback puede redirigir como exitoso con persistencia parcial.
- **Fix recomendado**: Validar errores de cada write; si falla, registrar `ml_error` y no marcar `ml_connected=true`.
- **Estado**: PENDIENTE

## Hallazgo: Superficie de autorizacion en layouts depende de disciplina por pagina
- **Nivel**: MEDIO
- **Archivo**: `app/(operator)/operator/layout.tsx`, `app/(client)/client/layout.tsx`
- **Descripcion**: Los layouts no fuerzan auth/rol. Hoy la proteccion existe en funciones de datos por pagina, pero una pagina nueva podria quedar expuesta si no reutiliza esos guards.
- **Fix recomendado**: Agregar guard de sesion+rol en layout de cada area para defensa en profundidad.
- **Estado**: PENDIENTE

## Hallazgo: RLS de tablas y buckets base esta correctamente definida
- **Nivel**: BAJO
- **Archivo**: `supabase/migrations/0001_initial_schema.sql`, `supabase/migrations/0002_pricing_proposals.sql`, `supabase/migrations/0003_meli_sessions.sql`
- **Descripcion**: Se verifico RLS habilitado y politicas para tablas criticas (`clients`, `diagnostics`, `score_history`, `actions`, `client_files`, `meli_sessions`, `scraping_jobs`, `weekly_reports`) y bucket `meli-sessions`.
- **Fix recomendado**: Mantener cobertura con tests de politicas por rol.
- **Estado**: RESUELTO

## Hallazgo: Endpoints internos con `x-cron-secret` validados
- **Nivel**: BAJO
- **Archivo**: `app/api/internal/health/route.ts`, `app/api/internal/daily-scraping/route.ts`, `app/api/internal/consolidate-scraping/route.ts`
- **Descripcion**: Los endpoints internos validan header secreto correctamente.
- **Fix recomendado**: Sumar rate limiting y logging estructurado por IP/origen.
- **Estado**: RESUELTO

## Hallazgo: Gap de proceso de auditoria previa
- **Nivel**: MEDIO
- **Archivo**: `docs/testing-cambios.md`, `docs/bugs-encontrados.md`
- **Descripcion**: No existen los documentos de testing requeridos por regla del auditor, por lo que faltan evidencias de bugs previos y cobertura.
- **Fix recomendado**: Exigir estos entregables como condicion del pipeline de auditoria.
- **Estado**: PENDIENTE
