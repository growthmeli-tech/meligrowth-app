export function logServerError(scope: string, error: unknown, metadata?: Record<string, unknown>) {
  console.error(`[${scope}]`, error, metadata ?? {});
}
