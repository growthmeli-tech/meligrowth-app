import type { Database } from "@/lib/supabase/database.types";
import { calcSellingPrice, type SellingPriceResult } from "@/lib/pricing/calculator";
import type { MargenesRow } from "@/lib/ingestion/types";

type AlertInsert = Database["public"]["Tables"]["alerts"]["Insert"];

export type SkuPricingComputed = {
  producto: string;
  costo: number;
  margen_pct: number | null;
  result: SellingPriceResult;
};

/**
 * Riesgos sobre filas con precio calculado; se insertan luego con `createAlertsBulk`.
 */
export function detectPricingRisks(healthId: string, mlAccountId: string, skus: SkuPricingComputed[]): AlertInsert[] {
  const out: AlertInsert[] = [];
  for (const row of skus) {
    if (!row.result.converged || !Number.isFinite(row.result.precio_venta) || row.result.precio_venta <= 0) {
      out.push({
        ml_account_id: mlAccountId,
        health_id: healthId,
        categoria: "pricing",
        prioridad: "alta",
        titulo: "Pricing: precio de venta no resoluble",
        descripcion: `No se pudo calcular PVP de forma coherente: ${row.producto}.`,
        accion_concreta: "Revisar costo, márgenes, comisión y envío en la planilla",
        benchmark_objetivo: null,
        audiencia: "operator",
        steps: []
      });
    } else {
      const ratio = row.costo / row.result.precio_venta;
      if (ratio > 0.9) {
        out.push({
          ml_account_id: mlAccountId,
          health_id: healthId,
          categoria: "pricing",
          prioridad: "media",
          titulo: "Estructura de márgenes muy ajustada",
          descripcion: `El costo supera el 90% del PVP estimado en ${row.producto}.`,
          accion_concreta: "Revisar supuestos de publicidad, logística y margen",
          benchmark_objetivo: null,
          audiencia: "operator",
          steps: []
        });
      }
    }
  }
  return out;
}

export function computeSkuPricingRow(row: Pick<MargenesRow, "costo" | "logistica" | "publicidad_pct" | "margen_pct" | "producto">): SkuPricingComputed {
  const result = calcSellingPrice(row);
  return { producto: row.producto, costo: row.costo, margen_pct: row.margen_pct, result };
}
