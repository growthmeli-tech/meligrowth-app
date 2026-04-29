import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type IngestionRunRow = Database["public"]["Tables"]["ingestion_runs"]["Row"];
type IngestionRunInsert = Database["public"]["Tables"]["ingestion_runs"]["Insert"];

/** Trazas por bloque para observabilidad (JSON en ingestion_runs.blocks_fetched). */
export type IngestionBlockEntry = {
  source: string;
  ok: boolean;
  error_kind?: string;
  message?: string;
};

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

/**
 * Inicio de corrida de ingesta (service role): RLS de ingestion_runs solo permite equipo interno;
 * el pipeline de sync usa esto para dejar rastro aunque el caller no sea MG.
 */
export async function createIngestionRunPipeline(
  payload: Pick<IngestionRunInsert, "ml_account_id" | "source"> & {
    blocks_fetched?: Record<string, unknown>;
  }
): Promise<ActionResult<{ id: string }>> {
  const supabase = createServiceSupabaseClient();
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      ml_account_id: payload.ml_account_id,
      source: payload.source,
      status: "running",
      blocks_fetched: (payload.blocks_fetched ?? {}) as Json,
      started_at: startedAt,
      error_msg: null
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("data-v2.createIngestionRunPipeline", error ?? "ingestion_run_not_created", payload);
    return {
      success: false,
      error: error && isPostgresError(error) ? formatSupabaseError(error) : "No se pudo crear ingestion_run",
      code: error?.code
    };
  }

  return { success: true, data: { id: data.id } };
}

export async function finishIngestionRunPipeline(
  id: string,
  payload: Pick<IngestionRunInsert, "status" | "blocks_fetched" | "error_msg">
): Promise<ActionResult<null>> {
  const supabase = createServiceSupabaseClient();
  const finishedAt = new Date().toISOString();
  const { error } = await supabase
    .from("ingestion_runs")
    .update({
      status: payload.status,
      blocks_fetched: payload.blocks_fetched as Json,
      error_msg: payload.error_msg ?? null,
      finished_at: finishedAt
    })
    .eq("id", id);

  if (error) {
    logServerError("data-v2.finishIngestionRunPipeline", error, { id });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo actualizar ingestion_run",
      code: error.code
    };
  }

  return { success: true, data: null };
}
