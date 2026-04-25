# Cambios de capa de datos

- `lib/data.ts`, `lib/data/index.ts`, `lib/data/clients.ts`, `lib/data/diagnostics.ts`, `lib/data/files.ts`, `lib/data/notifications.ts`, `lib/data/pricing.ts`, `lib/data/dashboard.ts`: se reorganizo la capa de datos por dominio para reducir acoplamiento y facilitar mantenimiento/escalabilidad.
- `lib/types/enums.ts`: se centralizaron enums de dominio sincronizados con el schema SQL para evitar literales duplicados y errores de casteo.
- `lib/supabase/database.types.ts`: se completo `public.Enums` con los enums reales de la base para tipado extremo a extremo desde Supabase.
- `lib/config/constants.ts`: se consolidaron constantes de negocio/limites para evitar magic numbers repetidos.
- `lib/utils/errors.ts`, `lib/utils/scores.ts`, `lib/utils/dates.ts`: se unificaron utilidades de errores, score y fechas para consistencia transversal en acciones y queries.
- `lib/data/dashboard.ts`: se optimizaron queries del dashboard de operador con `select` explicitos y columnas minimas necesarias.
- `app/(operator)/operator/clients/[id]/actions.ts`, `app/(operator)/operator/clients/[id]/settings/actions.ts`, `app/(operator)/operator/clients/new/actions.ts`, `app/notifications/actions.ts`: se estandarizaron respuestas a `ActionResult<T>` con manejo explicito de errores y `code`.
- `app/api/ml/auth/callback/route.ts`, `lib/ml/pipeline.ts`, `lib/ml/auth.ts`, `lib/diagnostics/consolidate-scraping.ts`, `lib/scraping/daily-dispatch.ts`, `app/api/internal/daily-scraping/route.ts`, `app/api/internal/consolidate-scraping/route.ts`: se audito y corrigio el uso de service role para dejarlo solo en flujos internos/cron.
