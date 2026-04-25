import type { PostgrestError } from "@supabase/supabase-js";

export function isPostgresError(error: unknown): error is PostgrestError {
  return typeof error === "object" && error !== null && "code" in error;
}

export function formatSupabaseError(error: PostgrestError): string {
  const messages: Record<string, string> = {
    "23505": "Ya existe un registro con esos datos",
    "23503": "Referencia a un registro que no existe",
    "42501": "No tenes permisos para realizar esta operacion",
    PGRST116: "No se encontro el registro solicitado"
  };
  return messages[error.code] ?? "Error inesperado. Intenta de nuevo.";
}

export function logServerError(operation: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[${operation}]`, {
    error,
    context,
    timestamp: new Date().toISOString()
  });
}
