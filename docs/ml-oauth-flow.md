# Flujo OAuth de Mercado Libre (v2)

Este documento describe el flujo completo para conectar una `ml_account` al sistema interno de Meli Growth usando OAuth de Mercado Libre.

## Objetivo

- Conectar una cuenta de Mercado Libre desde `/internal/clients/[id]/settings`.
- Usar `ml_account_id` como `state` de OAuth.
- Guardar tokens en Supabase Storage (`meli-sessions`) sin exponer secretos en el cliente.
- Persistir `seller_id` en `ml_accounts` para habilitar sincronizaciones reales.

## Diagrama ASCII

```text
+-------------------------------+
| /internal/clients/[id]        |
| Tab: Configurar ML            |
+---------------+---------------+
                |
                v
+-------------------------------+
| /internal/clients/[id]/settings|
| Server Component               |
| - getServerEnv()               |
| - getMLAuthorizationUrl()      |
+---------------+---------------+
                |
                | click "Conectar/Reconectar"
                v
+-------------------------------+
| auth.mercadolibre.com.ar      |
| OAuth authorization            |
+---------------+---------------+
                |
                | redirect with code + state
                v
+-------------------------------+
| /api/ml/auth/callback         |
| - valida state UUID           |
| - exchangeCodeForTokens()     |
| - saveSessionTokens()         |
| - update ml_accounts.seller_id|
+---------------+---------------+
                |
                | success
                v
+-------------------------------+
| /internal/clients/[company_id]|
| ?ml_connected=true            |
| banner verde de confirmacion  |
+-------------------------------+

En error:
/internal/clients?ml_error=...
```

## Detalle por paso

1. El operador entra a `settings` de una company.
2. El Server Component resuelve la `ml_account` activa y verifica configuración de entorno con `getServerEnv()`.
3. La URL OAuth se construye en el servidor con `getMLAuthorizationUrl(mlAccountId)`.
4. El componente cliente solo recibe:
   - `isConfigured`
   - `oauthUrl`
   - `mlAccountId`
   - estado de conexión (`seller_id`)
5. ML redirige a `/api/ml/auth/callback` con `code` y `state`.
6. El callback valida que `state` sea UUID y exista en `ml_accounts`.
7. Se intercambia `code` por tokens con `exchangeCodeForTokens()`.
8. Tokens se guardan en Storage bucket `meli-sessions` en path `{ml_account_id}/session.json`.
9. Se actualiza `ml_accounts.seller_id` con `tokens.user_id`.
10. Se redirige a `/internal/clients/{company_id}?ml_connected=true`.

## Seguridad

- `ML_CLIENT_SECRET` se consume solo en servidor (API routes/lib server).
- `getServerEnv()` se usa exclusivamente desde Server Components y API routes.
- El cliente nunca recibe secretos; solo recibe estado y URL de autorización ya construida.

## Resultado UX esperado

- Si falta configuración, `settings` muestra instrucciones para admin.
- Si no está conectada, se muestra CTA de conexión.
- Si está conectada, se muestra `seller_id`, estado conectado y acciones de reconexión/sincronización.
- Al volver del callback, la vista de cuenta muestra feedback visual de éxito o error.
