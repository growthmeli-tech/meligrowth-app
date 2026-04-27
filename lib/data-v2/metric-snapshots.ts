import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type MetricSnapshotInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

const METRIC_SNAPSHOT_SELECT =
  "id, ml_account_id, snapshot_date, source, reclamos, mediaciones, cancelaciones_vendedor, envios_a_tiempo, pubs_activas_pct, pubs_optimizadas_pct, ctr, margen_pre_ads, gasto_ads, ventas_ads, ventas_totales, acos, roas, tacos, incidencias_pct, uso_full_flex_pct, cancelaciones_stock_pct, skus_sin_stock_pct, dias_stock, lead_time_reposicion, sistema_reposicion, data_sources, created_at";

export async function listMetricSnapshotsByAccount(
  mlAccountId: string,
  limit = 30
): Promise<ActionResult<MetricSnapshotRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("metric_snapshots")
    .select(METRIC_SNAPSHOT_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logServerError("data-v2.listMetricSnapshotsByAccount", error, { mlAccountId, limit });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar snapshots",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as MetricSnapshotRow[] };
}

export async function getLatestMetricSnapshotByAccount(mlAccountId: string): Promise<ActionResult<MetricSnapshotRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("metric_snapshots")
    .select(METRIC_SNAPSHOT_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logServerError("data-v2.getLatestMetricSnapshotByAccount", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar el snapshot mas reciente",
      code: error.code
    };
  }

  return { success: true, data: (data as MetricSnapshotRow | null) ?? null };
}

export async function createMetricSnapshot(payload: MetricSnapshotInsert): Promise<ActionResult<MetricSnapshotRow>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("metric_snapshots").insert(payload).select(METRIC_SNAPSHOT_SELECT).single();

  if (error || !data) {
    logServerError("data-v2.createMetricSnapshot", error ?? "snapshot_not_created", { mlAccountId: payload.ml_account_id });
    return {
      success: false,
      error: error && isPostgresError(error) ? formatSupabaseError(error) : "No se pudo crear el snapshot",
      code: error?.code
    };
  }

  return { success: true, data: data as MetricSnapshotRow };
}
