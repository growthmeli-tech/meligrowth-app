## Hallazgo: RLS v2 habilitado en tablas nuevas, con cobertura parcial por rol
- **Nivel**: ALTO
- **Archivo**: `supabase/migrations/0004_new_model_360.sql`
- **Descripcion**: Las tablas `companies`, `ml_accounts`, `users_v2`, `user_account_access`, `metric_snapshots`, `account_health`, `alerts`, `tasks` tienen RLS habilitado y politicas de lectura para usuarios finales. Para gestion (`INSERT/UPDATE/DELETE`) la mayoria queda restringida al equipo interno (`is_meli_growth_team()`), lo cual es correcto para MVP operativo.
- **Fix recomendado**: Mantener este modelo de escritura centralizada y agregar tests de politicas por rol para cada tabla v2.
- **Estado**: RESUELTO

## Hallazgo: `is_meli_growth_team()` y `can_access_ml_account()` funcionan, pero no fuerzan limites de company para roles cliente
- **Nivel**: CRITICO
- **Archivo**: `supabase/migrations/0004_new_model_360.sql`
- **Descripcion**: `can_access_ml_account()` da acceso por existencia de fila en `user_account_access` (o por equipo interno), sin validar que un `client_manager` pertenezca a la misma company del `ml_account` ni que `client_operator` quede limitado a una sola cuenta. Si se crea un acceso cruzado por error operativo, la RLS lo habilita.
- **Fix recomendado**: Endurecer `can_access_ml_account()` con chequeo por rol+company y/o constraints que impidan accesos cruzados para roles cliente.
- **Estado**: PENDIENTE

## Hallazgo: `/ops/**` si verifica `ops_access_enabled`, pero la columna no existe en schema v2
- **Nivel**: CRITICO
- **Archivo**: `middleware.ts`, `supabase/migrations/0004_new_model_360.sql`, `lib/supabase/database.types.ts`
- **Descripcion**: El middleware consulta `user_account_access.ops_access_enabled` antes de permitir `/ops/**`, pero ni la migracion 0004 ni los tipos incluyen esa columna. En runtime esto puede devolver error o `null`, bloqueando acceso legitimo a operadores.
- **Fix recomendado**: Crear migracion que agregue `ops_access_enabled` (con default claro) y actualizar tipos/reglas de negocio para usarla de forma consistente.
- **Estado**: PENDIENTE

## Hallazgo: Regla Copilot de `/ops/` no esta alineada con el contexto de producto
- **Nivel**: ALTO
- **Archivo**: `middleware.ts`, `docs/meligrowth-product-context.md`
- **Descripcion**: En Copilot, la operacion diaria deberia poder ser usada por `internal_operator_meli_growth`; hoy `/ops/**` solo permite `client_operator` (y solo si `ops_access_enabled=true`), por lo que el modelo 360 vs Copilot queda incompleto en autorizacion.
- **Fix recomendado**: Incorporar regla por plan (`companies.plan`) + rol interno para habilitar flujo `/ops/**` en cuentas Copilot.
- **Estado**: PENDIENTE

## Hallazgo: Tokens ML siguen almacenados en Storage, no en columnas de DB
- **Nivel**: BAJO
- **Archivo**: `app/api/ml/auth/callback/route.ts`, `lib/ml/auth.ts`, `supabase/migrations/0003_meli_sessions.sql`
- **Descripcion**: La DB guarda `storage_path` en `meli_sessions`; `access_token/refresh_token` se escriben en bucket `meli-sessions`. No se encontraron columnas de tokens en tablas SQL.
- **Fix recomendado**: Mantener el patron y reforzar cifrado consistente en write/refresh.
- **Estado**: RESUELTO

## Hallazgo: Riesgo de cifrado inconsistente de tokens durante refresh
- **Nivel**: CRITICO
- **Archivo**: `app/api/ml/auth/callback/route.ts`, `lib/ml/auth.ts`
- **Descripcion**: El callback cifra payload cuando hay `APP_ENCRYPTION_KEY`, pero `saveSessionTokens()` vuelve a subir JSON plano en refresh. Esto puede degradar seguridad luego de la primera rotacion de token.
- **Fix recomendado**: Centralizar serializacion de tokens en una sola funcion (siempre cifrada) y agregar test callback->refresh->read.
- **Estado**: PENDIENTE

## Hallazgo: `client_manager` y `client_operator` no tienen garantia fuerte de aislamiento absoluto
- **Nivel**: ALTO
- **Archivo**: `supabase/migrations/0004_new_model_360.sql`, `lib/data-v2/viewer.ts`
- **Descripcion**: A nivel de vistas, `client_manager` usa `company_id` y `client_operator` usa cuenta primaria de `user_account_access`, pero el aislamiento final depende de datos correctos en `user_account_access` y no de constraints estrictos por rol.
- **Fix recomendado**: Agregar constraints/politicas explicitas: manager solo cuentas de su company, operator solo cuentas con `access_type='operator'` y, si aplica negocio, maximo una cuenta activa.
- **Estado**: PENDIENTE
