import { revalidatePath } from "next/cache";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { createIngestionLog, updateIngestionLog } from "@/lib/data-v2/file-ingestion-log";
import { utcTodaySnapshotDate } from "@/lib/data-v2/snapshot-date";
import { parseSkusStockRows } from "@/lib/ingestion/parsers/parse-skus-stock";
import type { IngestionResult, SkusStockRow } from "@/lib/ingestion/types";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type MetricRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type MetricInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

function computeSkusMetrics(rows: SkusStockRow[]) {
  if (rows.length === 0) {
    return { skus_sin_stock_pct: 0, dias_stock: null as number | null };
  }
  const cero = rows.filter((r) => r.stock === 0).length;
  const skus_sin_stock_pct = (cero / rows.length) * 100;
  const conDias = rows.map((r) => r.dias_stock).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
  const dias_stock = conDias.length > 0 ? conDias.reduce((a, b) => a + b, 0) / conDias.length : null;
  return { skus_sin_stock_pct, dias_stock };
}

export async function ingestSkusStock(
  mlAccountId: string,
  companyId: string,
  rows: SkusStockRow[],
  filename: string,
  storagePath: string
): Promise<IngestionResult> {
  const v = parseSkusStockRows(rows as unknown as Record<string, unknown>[]);
  if (v.valid.length === 0 || v.errors.length > 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Rechazado: volve a importar con filas validas."] };
  }

  const supabase = await createServerSupabaseClient();
  const log = await createIngestionLog({
    ml_account_id: mlAccountId,
    company_id: companyId,
    template_type: "skus_stock",
    filename,
    storage_path: storagePath,
    rows_total: rows.length,
    rows_valid: v.valid.length,
    rows_error: 0,
    status: "processing"
  });
  if (!log.success) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [log.error] };
  }
  const logId = log.data.id;
  const metrics = computeSkusMetrics(v.valid);
  const date = utcTodaySnapshotDate();
  const { data: existing, error: loadErr } = await supabase
    .from("metric_snapshots")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .eq("snapshot_date", date)
    .maybeSingle();
  if (loadErr) {
    logServerError("ingest-skus.load", loadErr, { mlAccountId });
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { message: isPostgresError(loadErr) ? formatSupabaseError(loadErr) : String((loadErr as { message?: string }).message ?? loadErr) },
      processed_at: new Date().toISOString()
    });
    return {
      success: false,
      rows_processed: 0,
      metrics_updated: {},
      alerts_generated: 0,
      errors: [isPostgresError(loadErr) ? formatSupabaseError(loadErr) : "No se pudo cargar snapshot"]
    };
  }
  const previousSnapshot = (existing as MetricRow | null) ?? null;
  const base = previousSnapshot ?? ({} as Partial<MetricRow>);
  const prevSrc =
    base.data_sources && typeof base.data_sources === "object" && !Array.isArray(base.data_sources) ? { ...(base.data_sources as Record<string, string>) } : {};
  prevSrc.stock = "csv";

  const { id: _ignoreId, created_at: _ignoreC, ...snapRest } = (base as MetricRow) || {};
  void _ignoreId;
  void _ignoreC;

  const payload: MetricInsert = {
    ...(Object.keys(snapRest).length ? (snapRest as object) : {}),
    ml_account_id: mlAccountId,
    snapshot_date: date,
    source: "csv",
    skus_sin_stock_pct: metrics.skus_sin_stock_pct,
    dias_stock: metrics.dias_stock,
    data_sources: prevSrc
  } as MetricInsert;

  const snap = await createMetricSnapshot(payload);
  if (!snap.success || !snap.data) {
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { message: snap.success === false ? snap.error : "sin snapshot" },
      processed_at: new Date().toISOString()
    });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [snap.success === false ? snap.error : "Error"] };
  }

  const pipe = await runRecommendationsPipelineV2({ ml_account_id: mlAccountId, metric_snapshot_id: snap.data.id });
  if (!pipe.success) {
    if (previousSnapshot) {
      const { id: _p, created_at: _pc, ...pr } = previousSnapshot;
      void _p;
      void _pc;
      await createMetricSnapshot({ ...pr, ml_account_id: mlAccountId, snapshot_date: date } as MetricInsert);
    } else {
      await supabase.from("metric_snapshots").delete().eq("id", snap.data.id);
    }
    const msg = !pipe.success ? pipe.error : "Pipeline fallo";
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { message: msg },
      processed_at: new Date().toISOString()
    });
    revalidatePath(`/internal/clients/${companyId}/files`);
    return { success: false, rows_processed: v.valid.length, metrics_updated: {}, alerts_generated: 0, errors: [msg || "Pipeline fallo"] };
  }
  const alertsN = pipe.data?.persisted_alerts_count ?? 0;
  await updateIngestionLog(logId, {
    status: "success",
    rows_valid: v.valid.length,
    rows_error: 0,
    error_summary: null,
    metrics_updated: { skus_sin_stock_pct: metrics.skus_sin_stock_pct, dias_stock: metrics.dias_stock },
    alerts_generated: alertsN,
    processed_at: new Date().toISOString()
  });
  revalidatePath(`/internal/clients/${companyId}/files`);
  return {
    success: true,
    rows_processed: v.valid.length,
    metrics_updated: {
      skus_sin_stock_pct: Math.round(metrics.skus_sin_stock_pct * 100) / 100,
      dias_stock: metrics.dias_stock == null ? "N/D" : Math.round(metrics.dias_stock * 100) / 100
    },
    alerts_generated: alertsN,
    errors: [],
    log_id: logId
  };
}
