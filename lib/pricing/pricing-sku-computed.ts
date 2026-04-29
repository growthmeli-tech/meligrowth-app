import type { Database } from "@/lib/supabase/database.types";
import { computeSkuPricingRow, detectPricingRisks, type SkuPricingComputed } from "@/lib/pricing/alerts";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

/** Ingesta por planilla: defaults si el operador dejó null (mismo criterio que `parse-margenes-costos`). */
const DEF_PUBLICIDAD = 0.1;
const DEF_MARGEN = 0.15;

/**
 * Construye el input del calculador a partir de una fila `pricing_skus` persistida.
 */
export function pricingSkuRowToComputed(row: PricingSkuRow): SkuPricingComputed {
  return computeSkuPricingRow({
    producto: row.producto,
    costo: Number(row.costo),
    logistica: row.logistica,
    publicidad_pct: row.publicidad_pct !== null && row.publicidad_pct !== undefined ? Number(row.publicidad_pct) : DEF_PUBLICIDAD,
    margen_pct: row.margen_pct !== null && row.margen_pct !== undefined ? Number(row.margen_pct) : DEF_MARGEN
  });
}

/** Cantidad de alertas que generaría `detectPricingRisks` (sin persistir). */
export function countPricingRiskAlerts(healthId: string | null, mlAccountId: string, rows: PricingSkuRow[]): number {
  const computed = rows.map(pricingSkuRowToComputed);
  const hid = healthId ?? "00000000-0000-4000-8000-000000000000";
  return detectPricingRisks(hid, mlAccountId, computed).length;
}
