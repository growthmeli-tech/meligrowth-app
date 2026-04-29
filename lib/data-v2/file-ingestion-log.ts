import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";
import type { TemplateType } from "@/lib/ingestion/types";

type IngestionRow = Database["public"]["Tables"]["file_ingestion_log"]["Row"];
type IngestionInsert = Database["public"]["Tables"]["file_ingestion_log"]["Insert"];
type IngestionUpdate = Database["public"]["Tables"]["file_ingestion_log"]["Update"];

const SELECT =
  "id, ml_account_id, company_id, template_type, filename, storage_path, rows_total, rows_valid, rows_error, status, error_summary, metrics_updated, alerts_generated, processed_at, created_at";

export async function createIngestionLog(
  row: IngestionInsert
): Promise<ActionResult<IngestionRow>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("file_ingestion_log").insert(row).select(SELECT).single();
  if (error || !data) {
    logServerError("file-ingestion-log.create", error ?? "no_row", { ml: row.ml_account_id });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo registrar ingesta", code: error?.code };
  }
  return { success: true, data: data as IngestionRow };
}

export async function updateIngestionLog(
  id: string,
  patch: IngestionUpdate
): Promise<ActionResult<IngestionRow>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("file_ingestion_log").update(patch).eq("id", id).select(SELECT).single();
  if (error || !data) {
    logServerError("file-ingestion-log.update", error ?? "no_row", { id });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo actualizar registro de ingesta", code: error?.code };
  }
  return { success: true, data: data as IngestionRow };
}

export async function listIngestionLogsByAccount(
  mlAccountId: string,
  limit = 100
): Promise<ActionResult<IngestionRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("file_ingestion_log")
    .select(SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logServerError("file-ingestion-log.list", error, { mlAccountId });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo leer el historial", code: error.code };
  }
  return { success: true, data: (data ?? []) as IngestionRow[] };
}

export async function getLastSuccessIngestionByTemplate(
  mlAccountId: string,
  template: TemplateType
): Promise<ActionResult<IngestionRow | null>> {
  if (template === "unknown") return { success: true, data: null };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("file_ingestion_log")
    .select(SELECT)
    .eq("ml_account_id", mlAccountId)
    .eq("template_type", template)
    .eq("status", "success")
    .order("processed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo leer la ultima ingesta", code: error.code };
  }
  return { success: true, data: (data as IngestionRow) ?? null };
}
