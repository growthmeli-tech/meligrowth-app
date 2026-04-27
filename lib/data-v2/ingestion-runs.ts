import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type IngestionRunRow = Database["public"]["Tables"]["ingestion_runs"]["Row"];

const INGESTION_RUN_SELECT =
  "id, ml_account_id, source, status, blocks_fetched, error_msg, started_at, finished_at, created_at";

export async function listIngestionRunsByAccount(
  mlAccountId: string,
  limit = 20
): Promise<ActionResult<IngestionRunRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ingestion_runs")
    .select(INGESTION_RUN_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logServerError("data-v2.listIngestionRunsByAccount", error, { mlAccountId, limit });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar ingestion_runs",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as IngestionRunRow[] };
}

export async function getLatestIngestionRunByAccount(mlAccountId: string): Promise<ActionResult<IngestionRunRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ingestion_runs")
    .select(INGESTION_RUN_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logServerError("data-v2.getLatestIngestionRunByAccount", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar el ultimo ingestion_run",
      code: error.code
    };
  }

  return { success: true, data: (data as IngestionRunRow | null) ?? null };
}
