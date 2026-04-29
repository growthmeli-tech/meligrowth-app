import type { Database } from "@/lib/supabase/database.types";

export type InternalBlockSlug = "salud" | "publicaciones" | "ads" | "logistica" | "stock";

type MetricSnapshotInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];
type MetricColumn = keyof MetricSnapshotInsert;

/** Columns from metric_snapshots that may be edited inline per diagnóstico block (server validates writes). */
export const BLOCK_METRIC_COLUMNS: Record<InternalBlockSlug, MetricColumn[]> = {
  salud: ["reclamos", "mediaciones", "cancelaciones_vendedor", "envios_a_tiempo"],
  publicaciones: ["pubs_activas_pct", "pubs_optimizadas_pct", "ctr"],
  ads: ["margen_pre_ads", "gasto_ads", "ventas_ads", "ventas_totales", "acos", "roas", "tacos"],
  logistica: ["incidencias_pct", "uso_full_flex_pct", "cancelaciones_stock_pct"],
  stock: ["skus_sin_stock_pct", "dias_stock", "lead_time_reposicion"]
};

export function pickAllowedSnapshotColumns(
  block: InternalBlockSlug,
  metrics: Partial<MetricSnapshotInsert>
): Partial<MetricSnapshotInsert> {
  const allowed = new Set<string>(BLOCK_METRIC_COLUMNS[block]);
  const out: Partial<MetricSnapshotInsert> = {};
  for (const key of Object.keys(metrics) as MetricColumn[]) {
    if (allowed.has(key) && metrics[key] !== undefined) {
      (out as Record<string, unknown>)[key] = metrics[key];
    }
  }
  return out;
}
