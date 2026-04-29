import type { MargenesRow } from "@/lib/ingestion/types";

/** Comisión promedio oficial AR (producto) */
const COMISION_ML = 0.1375;

function flexFijoDePrecio(precio: number): number {
  if (precio >= 33_000) return 0;
  if (precio <= 15_999) return 1255;
  if (precio <= 23_999) return 2500;
  return 3030;
}

function fullFijoDePrecio(precio: number): number {
  if (precio >= 33_000) return 0;
  if (precio <= 15_000) return 1095;
  if (precio <= 25_000) return 2190;
  return 2628;
}

export type SellingPriceResult = {
  precio_venta: number;
  ganancia_unit: number;
  roi: number;
  converged: boolean;
};

/**
 * Resuelve precio de venta a partir de costo, comisión, envío, ads y margen
 * (misma lógica que `calcularPrecioVenta` en el documento de producto).
 */
export function calcSellingPrice(
  input: Pick<MargenesRow, "costo" | "logistica" | "publicidad_pct" | "margen_pct">
): SellingPriceResult {
  const { costo, publicidad_pct, logistica } = input;
  const pub = publicidad_pct;
  const marg = input.margen_pct ?? 0.15;

  if (costo <= 0) {
    return { precio_venta: 0, ganancia_unit: 0, roi: 0, converged: true };
  }

  const sumRates = (envPct: number) => 1 - COMISION_ML - pub - marg - envPct;
  if (logistica === "Retiro domicilio") {
    const d = sumRates(0);
    if (d <= 0.001) {
      return { precio_venta: Number.NaN, ganancia_unit: 0, roi: 0, converged: false };
    }
    const p = costo / d;
    return finalize(p, costo, marg);
  }

  const envPct = logistica === "Full" ? 0.1 : 0.07;

  let p = costo * 1.4;
  let converged = false;
  for (let i = 0; i < 45; i += 1) {
    const fijo = logistica === "Full" ? fullFijoDePrecio(p) : flexFijoDePrecio(p);
    const d = sumRates(envPct);
    if (d <= 0.001) {
      return { precio_venta: Number.NaN, ganancia_unit: 0, roi: 0, converged: false };
    }
    const pNext = (costo + fijo) / d;
    if (Number.isFinite(pNext) && Math.abs(pNext - p) < 0.5) {
      p = pNext;
      converged = true;
      break;
    }
    p = pNext;
  }

  if (!converged && Number.isFinite(p)) {
    converged = true;
  }
  if (!Number.isFinite(p) || p <= 0) {
    return { precio_venta: Number.NaN, ganancia_unit: 0, roi: 0, converged: false };
  }
  return finalize(p, costo, marg);
}

function finalize(p: number, costo: number, marg: number): SellingPriceResult {
  const precio_venta = Math.round(p * 100) / 100;
  const ganancia_unit = Math.round(precio_venta * marg * 100) / 100;
  const roi = costo > 0 ? Math.round((ganancia_unit / costo) * 10_000) / 100 : 0;
  return { precio_venta, ganancia_unit, roi, converged: true };
}
