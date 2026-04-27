import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { TaskStatus } from "@/lib/types/enums";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskEventRow = Database["public"]["Tables"]["task_events"]["Row"];

const TASK_SELECT =
  "id, ml_account_id, alert_id, assigned_to, titulo, descripcion, prioridad, estado, due_date, completed_at, created_at";
const TASK_EVENT_SELECT = "id, task_id, user_id, evento, detalle, created_at";

export async function listTasksByAccount(
  mlAccountId: string,
  options?: { status?: TaskStatus; limit?: number }
): Promise<ActionResult<TaskRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("estado", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listTasksByAccount", error, { mlAccountId, ...options });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar tareas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as TaskRow[] };
}

export async function listPendingTasksByAccounts(accountIds: string[]): Promise<ActionResult<TaskRow[]>> {
  if (accountIds.length === 0) return { success: true, data: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .in("ml_account_id", accountIds)
    .in("estado", ["pendiente", "en_curso"])
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listPendingTasksByAccounts", error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar tareas pendientes",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as TaskRow[] };
}

export async function listTaskEvents(taskId: string): Promise<ActionResult<TaskEventRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("task_events")
    .select(TASK_EVENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listTaskEvents", error, { taskId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar eventos de tarea",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as TaskEventRow[] };
}
