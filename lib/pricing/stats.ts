import type { Database } from "@/lib/supabase/database.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

/** Margen objetivo ponderado por costo (solo filas con `margen_pct` no nulo). */
export function weightedMargenPctFromPricingSkus(rows: PricingSkuRow[]): number | null {
  let w = 0;
  let acc = 0;
  for (const r of rows) {
    if (r.margen_pct === null || r.margen_pct === undefined) continue;
    const c = Number(r.costo);
    if (!Number.isFinite(c) || c <= 0) continue;
    w += c;
    acc += Number(r.margen_pct) * c;
  }
  if (w <= 0) return null;
  return acc / w;
}
