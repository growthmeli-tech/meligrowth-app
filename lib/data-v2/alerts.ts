import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { AlertAudience } from "@/lib/types/enums";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type AlertInsert = Database["public"]["Tables"]["alerts"]["Insert"];

const ALERT_SELECT =
  "id, ml_account_id, health_id, categoria, prioridad, titulo, descripcion, accion_concreta, benchmark_objetivo, audiencia, resuelta, resuelta_at, created_at";

export async function listAlertsByAccount(
  mlAccountId: string,
  options?: { audience?: AlertAudience; includeResolved?: boolean; limit?: number }
): Promise<ActionResult<AlertRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false });

  if (!options?.includeResolved) {
    query = query.eq("resuelta", false);
  }
  if (options?.audience) {
    query = query.eq("audiencia", options.audience);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listAlertsByAccount", error, { mlAccountId, ...options });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

export async function listUrgentPendingAlertsByAccounts(accountIds: string[]): Promise<ActionResult<AlertRow[]>> {
  if (accountIds.length === 0) return { success: true, data: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .in("ml_account_id", accountIds)
    .eq("resuelta", false)
    .eq("prioridad", "urgente")
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listUrgentPendingAlertsByAccounts", error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas urgentes",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

export async function createAlertsBulk(payload: AlertInsert[]): Promise<ActionResult<AlertRow[]>> {
  if (payload.length === 0) {
    return { success: true, data: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("alerts").insert(payload).select(ALERT_SELECT);

  if (error) {
    logServerError("data-v2.createAlertsBulk", error, { count: payload.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron crear alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}
