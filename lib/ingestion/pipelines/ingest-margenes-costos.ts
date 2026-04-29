import { revalidatePath } from "next/cache";
import { createAlertsBulk } from "@/lib/data-v2/alerts";
import { createIngestionLog, updateIngestionLog } from "@/lib/data-v2/file-ingestion-log";
import { bulkReplacePricingSkusForFile } from "@/lib/data-v2/pricing-skus";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { utcTodaySnapshotDate } from "@/lib/data-v2/snapshot-date";
import { parseMargenesCostosRows } from "@/lib/ingestion/parsers/parse-margenes-costos";
import type { IngestionResult, MargenesRow } from "@/lib/ingestion/types";
import { detectPricingRisks } from "@/lib/pricing/alerts";
import { calcSellingPrice } from "@/lib/pricing/calculator";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type MetricRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type MetricInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];
type SkuIns = Database["public"]["Tables"]["pricing_skus"]["Insert"];

function weightedMarginPct(rows: MargenesRow[]) {
  const w = rows.reduce((s, r) => s + r.costo, 0);
  if (w <= 0) return null;
  return rows.reduce((s, r) => s + (r.margen_pct ?? 0.15) * r.costo, 0) / w;
}

export async function ingestMargenesCostos(
  mlAccountId: string,
  companyId: string,
  rawRows: Record<string, unknown>[],
  getCell: (row: Record<string, unknown>, field: string) => unknown,
  filename: string,
  storagePath: string
): Promise<IngestionResult> {
  const p = parseMargenesCostosRows(rawRows, getCell);
  if (p.valid.length === 0 || p.errors.length > 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Rechazado: filas con errores."] };
  }
  const supabase = await createServerSupabaseClient();
  const log = await createIngestionLog({
    ml_account_id: mlAccountId,
    company_id: companyId,
    template_type: "margenes_costos",
    filename,
    storage_path: storagePath,
    rows_total: rawRows.length,
    rows_valid: p.valid.length,
    rows_error: 0,
    status: "processing"
  });
  if (!log.success) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [log.error] };
  }
  const logId = log.data.id;
  const weighted = weightedMarginPct(p.valid);
  const marginPctHundred = weighted == null ? null : weighted * 100;

  const skus: SkuIns[] = p.valid.map((row) => {
    const price = row.selling ?? calcSellingPrice(row);
    return {
      ml_account_id: mlAccountId,
      sku: row.sku,
      producto: row.producto,
      costo: row.costo,
      peso_kg: row.peso_kg,
      logistica: row.logistica,
      reputacion: row.reputacion,
      publicidad_pct: row.publicidad_pct,
      margen_pct: row.margen_pct,
      precio_venta: Number.isFinite(price.precio_venta) ? price.precio_venta : null,
      ganancia_unit: price.ganancia_unit,
      roi: price.roi,
      source_file: storagePath
    };
  });

  const ins = await bulkReplacePricingSkusForFile(mlAccountId, storagePath, skus);
  if (!ins.success) {
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { message: ins.error },
      processed_at: new Date().toISOString()
    });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [ins.error] };
  }

  const date = utcTodaySnapshotDate();
  const { data: existing, error: loadErr } = await supabase
    .from("metric_snapshots")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .eq("snapshot_date", date)
    .maybeSingle();
  if (loadErr) {
    await bulkReplacePricingSkusForFile(mlAccountId, storagePath, []); // remove inserted
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { message: loadErr.message },
      processed_at: new Date().toISOString()
    });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [isPostgresError(loadErr) ? formatSupabaseError(loadErr) : "Snapshot"] };
  }
  const previous = (existing as MetricRow | null) ?? null;
  const base = previous ?? ({} as Partial<MetricRow>);
  const prevSrc =
    base.data_sources && typeof base.data_sources === "object" && !Array.isArray(base.data_sources) ? { ...(base.data_sources as Record<string, string>) } : {};
  prevSrc.ads = "csv";
  const { id: _a, created_at: _b, ...snapRest } = (base as MetricRow) || {};
  void _a;
  void _b;
  const payload: MetricInsert = {
    ...(Object.keys(snapRest).length ? (snapRest as object) : {}),
    ml_account_id: mlAccountId,
    snapshot_date: date,
    source: "csv",
    margen_pre_ads: marginPctHundred,
    data_sources: prevSrc
  } as MetricInsert;

  const snap = await createMetricSnapshot(payload);
  if (!snap.success || !snap.data) {
    await bulkReplacePricingSkusForFile(mlAccountId, storagePath, []);
    await updateIngestionLog(logId, { status: "error", error_summary: { err: "snapshot" }, processed_at: new Date().toISOString() });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [snap.success === false ? snap.error : "snapshot"] };
  }
  const pipe = await runRecommendationsPipelineV2({ ml_account_id: mlAccountId, metric_snapshot_id: snap.data.id });
  if (!pipe.success) {
    if (previous) {
      const { id, created_at, ...pr } = previous;
      void id;
      void created_at;
      await createMetricSnapshot({ ...pr, ml_account_id: mlAccountId, snapshot_date: date } as MetricInsert);
    } else {
      await supabase.from("metric_snapshots").delete().eq("id", snap.data.id);
    }
    await bulkReplacePricingSkusForFile(mlAccountId, storagePath, []);
    await updateIngestionLog(logId, {
      status: "error",
      error_summary: { err: "pipeline" },
      processed_at: new Date().toISOString()
    });
    revalidatePath(`/internal/clients/${companyId}/files`);
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [pipe.success === false ? pipe.error : "pipeline"] };
  }

  const comp = p.valid.map((r) => ({
    producto: r.producto,
    costo: r.costo,
    margen_pct: r.margen_pct,
    result: r.selling ?? calcSellingPrice(r)
  }));
  const alertPayload = detectPricingRisks(pipe.data.account_health.id, mlAccountId, comp);
  let extra = 0;
  if (alertPayload.length) {
    const a = await createAlertsBulk(alertPayload);
    if (a.success) {
      extra = a.data.length;
    } else {
      logServerError("ingest-margenes.alerts", a.error, { logId });
    }
  }
  const totalAlerts = (pipe.data.persisted_alerts_count ?? 0) + extra;
  await updateIngestionLog(logId, {
    status: "success",
    rows_valid: p.valid.length,
    rows_error: 0,
    error_summary: null,
    metrics_updated: {
      margen_pre_ads_pct: marginPctHundred,
      skus: p.valid.length
    },
    alerts_generated: totalAlerts,
    processed_at: new Date().toISOString()
  });
  revalidatePath(`/internal/clients/${companyId}/files`);
  return {
    success: true,
    rows_processed: p.valid.length,
    metrics_updated: { margen_pre_ads_pct: marginPctHundred == null ? "N/D" : marginPctHundred, skus_importados: p.valid.length },
    alerts_generated: totalAlerts,
    errors: [],
    log_id: logId
  };
}
