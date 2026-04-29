import type { MargenesRow } from "@/lib/ingestion/types";

/** Comisión ML — Verde / MercadoLíder (producto AR) */
export const COMISION_ML_VERDE = 0.1375;
/** Comisión ML — Naranja o Roja */
export const COMISION_ML_NARANJA = 0.12;

export type LogisticaType = MargenesRow["logistica"];
export type ReputacionType = MargenesRow["reputacion"];

export function normalizePct(v: number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return v > 1 ? v / 100 : v;
}

/** Tasa de comisión ML según reputación (INVARIANT-06). */
export function mlComisionRate(reputacion: ReputacionType | string | null | undefined): number {
  if (reputacion == null) return COMISION_ML_VERDE;
  const s = String(reputacion).toLowerCase();
  if (s.includes("naranja") || s.includes("roja")) return COMISION_ML_NARANJA;
  return COMISION_ML_VERDE;
}

/** Normaliza texto de DB / UI al tipo de reputación del motor. */
export function coerceReputacion(raw: string | null | undefined): ReputacionType {
  if (raw == null || String(raw).trim() === "") return "Verde / MercadoLíder";
  const s = String(raw).toLowerCase();
  if (s.includes("naranja") || s.includes("roja")) return "Naranja o Roja";
  return "Verde / MercadoLíder";
}

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

/**
 * Costo de envío / logística que asume el vendedor a un precio de venta dado
 * (misma estructura que el motor de precio objetivo: % sobre P + tramo fijo).
 */
export function calcShippingCostAtPrice(logistica: LogisticaType, precio: number): number {
  if (logistica === "Retiro domicilio") return 0;
  const envPct = logistica === "Full" ? 0.1 : 0.07;
  const fijo = logistica === "Full" ? fullFijoDePrecio(precio) : flexFijoDePrecio(precio);
  return envPct * precio + fijo;
}

export type SellingPriceInput = Pick<MargenesRow, "costo" | "logistica" | "publicidad_pct" | "margen_pct"> & {
  reputacion?: ReputacionType | string | null;
};

export type SellingPriceResult = {
  precio_venta: number;
  ganancia_unit: number;
  roi: number;
  converged: boolean;
};

/**
 * Resuelve precio de venta objetivo a partir de costo, comisión (por reputación), envío, ads y margen.
 * `publicidad_pct` y `margen_pct` pueden venir en 0–1 o 0–100; se normalizan con `normalizePct`.
 */
export function calcSellingPrice(input: SellingPriceInput): SellingPriceResult {
  const { costo, logistica } = input;
  const pub = normalizePct(input.publicidad_pct);
  const marg = normalizePct(input.margen_pct ?? 0.15) || 0.15;
  const comision = mlComisionRate(input.reputacion);

  if (costo <= 0) {
    return { precio_venta: 0, ganancia_unit: 0, roi: 0, converged: true };
  }

  const sumRates = (envPct: number) => 1 - comision - pub - marg - envPct;
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

export interface RealProfitResult {
  ganancia_real: number;
  margen_real: number;
  comision_$: number;
  envio_$: number;
  publicidad_$: number;
  costo_total: number;
  converged: boolean;
}

/**
 * Ganancia real del vendedor al precio actual de ML (no el margen objetivo del precio teórico).
 * ganancia_real = price_ml - costo - comision_$ - envio_$ - publicidad_$
 */
export function calcRealProfit(input: {
  price_ml: number;
  costo: number;
  logistica: LogisticaType;
  reputacion: ReputacionType | string | null | undefined;
  publicidad_pct: number;
  /** Reservado para costos de envío por peso cuando el modelo lo incorpore. */
  peso_kg: number | null;
}): RealProfitResult {
  const { price_ml, costo, logistica } = input;
  const pub = normalizePct(input.publicidad_pct);
  const comisionRate = mlComisionRate(input.reputacion);
  if (!Number.isFinite(price_ml) || price_ml <= 0 || !Number.isFinite(costo) || costo < 0) {
    return {
      ganancia_real: Number.NaN,
      margen_real: Number.NaN,
      comision_$: Number.NaN,
      envio_$: Number.NaN,
      publicidad_$: Number.NaN,
      costo_total: costo,
      converged: false
    };
  }

  const comision_$ = Math.round(price_ml * comisionRate * 100) / 100;
  const envio_$ = Math.round(calcShippingCostAtPrice(logistica, price_ml) * 100) / 100;
  const publicidad_$ = Math.round(price_ml * pub * 100) / 100;
  const costo_total = Math.round(costo * 100) / 100;
  const ganancia_raw = price_ml - costo_total - comision_$ - envio_$ - publicidad_$;
  const ganancia_real = Math.round(ganancia_raw * 100) / 100;
  const margen_real = Math.round((ganancia_real / price_ml) * 10_000) / 10_000;

  return {
    ganancia_real,
    margen_real,
    comision_$,
    envio_$,
    publicidad_$,
    costo_total,
    converged: Number.isFinite(ganancia_real) && Number.isFinite(margen_real)
  };
}

export interface StockStatus {
  status: "critico" | "reponer" | "saludable" | "exceso";
  units_to_buy: number;
  days_remaining: number | null;
  urgency: "urgente" | "pronto" | "ok";
}

export function calcStockStatus(input: {
  stock_actual: number;
  ventas_30d: number | null;
  safety_pct?: number;
}): StockStatus {
  const safety = input.safety_pct ?? 0.2;
  const { stock_actual, ventas_30d } = input;

  if (stock_actual === 0) {
    return { status: "critico", units_to_buy: 0, days_remaining: 0, urgency: "urgente" };
  }

  if (ventas_30d === null || ventas_30d === undefined) {
    return { status: "saludable", units_to_buy: 0, days_remaining: null, urgency: "ok" };
  }

  const daily_sales = ventas_30d / 30;
  const ideal_stock = ventas_30d * (1 + safety);
  const units_to_buy = Math.max(0, Math.round(ideal_stock - stock_actual));

  if (daily_sales <= 0) {
    return { status: "saludable", units_to_buy: 0, days_remaining: null, urgency: "ok" };
  }

  const days_remaining = Math.round((stock_actual / daily_sales) * 100) / 100;

  if (days_remaining < 7) {
    return { status: "critico", units_to_buy, days_remaining, urgency: "urgente" };
  }
  if (days_remaining < 15) {
    return { status: "reponer", units_to_buy, days_remaining, urgency: "pronto" };
  }
  if (stock_actual > ideal_stock * 2) {
    return { status: "exceso", units_to_buy: 0, days_remaining, urgency: "ok" };
  }
  return { status: "saludable", units_to_buy: 0, days_remaining, urgency: "ok" };
}
