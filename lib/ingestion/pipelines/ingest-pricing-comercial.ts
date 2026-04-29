import { revalidatePath } from "next/cache";
import { createIngestionLog, updateIngestionLog } from "@/lib/data-v2/file-ingestion-log";
import { calcScenarioRow, insertPricingScenariosBatch } from "@/lib/data-v2/pricing-scenarios";
import { parsePricingComercialRows } from "@/lib/ingestion/parsers/parse-pricing-comercial";
import type { IngestionResult, PricingComercialRow } from "@/lib/ingestion/types";
import type { Database } from "@/lib/supabase/database.types";
import { logServerError } from "@/lib/utils/errors";

type Insert = Database["public"]["Tables"]["pricing_scenarios"]["Insert"];

function getCell(row: Record<string, unknown>, f: string) {
  return row[f];
}

function bestByNet(scenarios: PricingComercialRow[]) {
  if (scenarios.length === 0) return null;
  let b = scenarios[0]!;
  let bNet = calcScenarioRow({
    current_revenue: b.current_revenue,
    projected_revenue: b.projected_revenue,
    gross_margin_pct: b.gross_margin_pct,
    delivery_cost: b.delivery_cost,
    months: b.months
  }).net_margin_pct;
  for (const s of scenarios.slice(1)) {
    const n = calcScenarioRow({
      current_revenue: s.current_revenue,
      projected_revenue: s.projected_revenue,
      gross_margin_pct: s.gross_margin_pct,
      delivery_cost: s.delivery_cost,
      months: s.months
    }).net_margin_pct;
    if (n > bNet) {
      b = s;
      bNet = n;
    }
  }
  return { plan: b.plan, net_margin_pct: bNet };
}

export async function ingestPricingComercial(
  mlAccountId: string,
  companyId: string,
  rawRows: Record<string, unknown>[],
  filename: string,
  storagePath: string
): Promise<IngestionResult> {
  const p = parsePricingComercialRows(rawRows, getCell);
  if (p.valid.length === 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Ningun escenario valido"] };
  }
  if (p.errors.length > 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Rechazado: filas con errores"] };
  }
  const log = await createIngestionLog({
    ml_account_id: mlAccountId,
    company_id: companyId,
    template_type: "pricing_comercial",
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
  const best = bestByNet(p.valid);
  const rows: Insert[] = p.valid.map((r) => {
    const c = calcScenarioRow({
      current_revenue: r.current_revenue,
      projected_revenue: r.projected_revenue,
      gross_margin_pct: r.gross_margin_pct,
      delivery_cost: r.delivery_cost,
      months: r.months
    });
    return {
      ml_account_id: mlAccountId,
      plan: r.plan,
      current_revenue: r.current_revenue,
      projected_revenue: r.projected_revenue,
      gross_margin_pct: r.gross_margin_pct,
      delivery_cost: r.delivery_cost,
      setup_fee: r.setup_fee,
      months: r.months,
      net_margin_pct: c.net_margin_pct,
      monthly_profit: c.monthly_profit,
      total_projected_profit: c.total_projected_profit,
      source_file: storagePath
    };
  });
  const ins = await insertPricingScenariosBatch(rows);
  if (!ins.success) {
    logServerError("ingest-pricing-scenarios", ins.error ?? "err", { logId });
    await updateIngestionLog(logId, { status: "error", error_summary: { m: ins.error }, processed_at: new Date().toISOString() });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [ins.error] };
  }
  await updateIngestionLog(logId, {
    status: "success",
    rows_valid: p.valid.length,
    rows_error: 0,
    error_summary: null,
    metrics_updated: { escenarios: p.valid.length, mejor_plan: best?.plan ?? "N/D", net_margin: best?.net_margin_pct },
    alerts_generated: 0,
    processed_at: new Date().toISOString()
  });
  revalidatePath(`/internal/clients/${companyId}/files`);
  return {
    success: true,
    rows_processed: p.valid.length,
    metrics_updated: {
      escenarios: p.valid.length,
      mejor_plan: best?.plan ?? "N/D",
      net_margin: best == null ? "N/D" : best.net_margin_pct
    },
    alerts_generated: 0,
    errors: [],
    log_id: logId
  };
}
