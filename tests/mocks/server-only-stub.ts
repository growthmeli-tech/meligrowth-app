/**
 * Vitest resolves `server-only` here so imports of `@/lib/supabase/server` do not throw.
 * Production uses the real `server-only` package (Next / RSC).
 */
