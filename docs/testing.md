# Testing

## Local

```bash
npm run build
npm run test
npm run test:e2e
npm run audit:console
```

Playwright levanta Next en `http://127.0.0.1:3100` y corre contra datos demo si Supabase no está configurado.

La auditoría de consola usa un navegador headless real y recorre rutas públicas, operator y client. Por default espera un server ya levantado en `AUDIT_BASE_URL`:

```bash
npx next start --hostname 127.0.0.1 --port 3200
AUDIT_BASE_URL=http://127.0.0.1:3200 npm run audit:console
```

## Supabase real

Para correr contra un entorno real, configurar:

```env
PLAYWRIGHT_BASE_URL=https://tu-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CRON_SECRET=
AUDIT_BASE_URL=https://tu-app.vercel.app
AUDIT_OPERATOR_EMAIL=
AUDIT_OPERATOR_PASSWORD=
AUDIT_CLIENT_EMAIL=
AUDIT_CLIENT_PASSWORD=
```

Con esas credenciales, `npm run audit:console` hace login real por formulario y audita:

- rutas públicas sin sesión
- vistas operator con usuario operator
- vistas client con usuario client

Si faltan credenciales en modo Supabase real, la auditoría marca los scopes autenticados como `skipped` para no dar falsos negativos.

La suite cubre:

- login y redirección operator
- dashboard operator, detalle, evolución y acciones
- carga de diagnóstico con generación de acciones
- dashboard cliente, métricas e historial
- upload de plantilla demo
- archivos, preview normalizada y notificaciones
- healthcheck interno
- onboarding guiado de clientes
- calculadora de precios operator
- creación, filtros y cierre de acciones operator
- configuración y edición de cliente operator
- filtros de notificaciones por estado y tipo
