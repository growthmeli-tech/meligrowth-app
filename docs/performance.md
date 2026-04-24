# Performance

## Decisiones aplicadas

- Las rutas autenticadas son dinámicas para evitar cache compartida entre usuarios.
- El overview operator evita N+1 queries: carga clientes activos y diagnósticos en consultas agrupadas.
- Las listas de detalle están limitadas:
  - acciones: 100
  - archivos: 50
  - historial de score: 18 puntos
- Las notificaciones se filtran por `user_id` además de depender de RLS.
- La migración incluye índices para dashboards, diagnósticos, notificaciones, archivos y scraping jobs.

## Caching

No se cachean respuestas privadas por defecto. Para Vercel/Supabase real, el siguiente paso seguro es cachear solo recursos públicos o agregados sin datos sensibles. Los dashboards deben permanecer server-rendered por usuario.

## Escala esperada

El dashboard operator queda preparado para decenas o cientos de clientes sin ejecutar una query de diagnóstico por card. Si la cartera crece por encima de cientos de cuentas activas, conviene agregar una vista SQL `latest_diagnostics` o una tabla mantenida por trigger para leer el último diagnóstico por cliente en una sola consulta indexada.

## Checks recomendados

```bash
npm run build
npm run test
npm run test:e2e
npm audit --audit-level=high
```
