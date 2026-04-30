import type { MargenesRow } from "@/lib/ingestion/types";
import {
  resolveLogisticsOperatingCostBreakdown,
  type LogisticsCostBreakdown
} from "@/lib/pricing/logistics-operating-cost";
import {
  type PriceBand,
  type ShippingCostInput,
  type ShippingCostEstimate,
  type ShippingReputationGroup,
  type WeightBand,
  estimateSellerShippingCostAr
} from "@/lib/pricing/shipping-costs-argentina";

/** Comisión ML — Verde / MercadoLíder (producto AR) */
export const COMISION_ML_VERDE = 0.1375;
/** Comisión ML — Naranja o Roja */
export const COMISION_ML_NARANJA = 0.12;

export type LogisticaType = MargenesRow["logistica"];
export type ReputacionType = MargenesRow["reputacion"];

/** Account-level fiscal / overhead inputs (no DB required — passed into `buildSkuDecisionState`). */
export type SellerFinancialSettings = {
  iibbPct: number | null;
  taxPct: number | null;
  internalLogisticsCost: number | null;
  fixedUnitCost?: number | null;
  additionalCostsPct?: number | null;
  additionalCostsFixed?: number | null;
  /** Full — solo si persistidos / pasados explícitamente (sin inventar). */
  fullFulfillmentCostPerUnit?: number | null;
  fullStorageCostPerUnit?: number | null;
  fullInboundCostPerUnit?: number | null;
};

export type FinancialCostBreakdown = {
  productCost: number | null;

  mlFeeAmount: number | null;
  mlFeePct: number | null;

  fixedUnitCost: number | null;

  adsAmount: number;
  adsPct: number;

  iibbAmount: number | null;
  iibbPct: number | null;

  taxAmount: number | null;
  taxPct: number | null;

  mlShippingAmount: number | null;
  fulfillmentAmount: number | null;
  /** @deprecated Usar `logisticsOperating`; se mantiene para UI que resta “logística interna”. */
  internalLogisticsAmount: number | null;
  /** Costo operativo por modo logístico (Full/Flex/Retiro); distinto del envío gratis (tabla ML). */
  logisticsOperatingAmount: number | null;
  logisticsOperating: LogisticsCostBreakdown;

  additionalCostsAmount: number | null;

  totalCost: number | null;
  netProfit: number | null;
  netMarginPct: number | null;

  /** AR free-shipping table / política comercial (no mezclar con modo logístico). */
  shipping: {
    sellerShippingCost: number | null;
    source: ShippingCostEstimate["source"];
    completeness: ShippingCostEstimate["completeness"];
    priceBand: PriceBand | null;
    weightBand: WeightBand | null;
    reputationGroup: ShippingReputationGroup;
    missing: string[];
    reasons: string[];
  };

  reasons: string[];
  missing: string[];
};

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

export function mlLogisticsVariableRate(logistica: LogisticaType): number {
  if (logistica === "Retiro domicilio") return 0;
  return logistica === "Full" ? 0.1 : 0.07;
}

export function mlLogisticsFixedAtPrice(logistica: LogisticaType, precio: number): number {
  if (logistica === "Retiro domicilio") return 0;
  return logistica === "Full" ? fullFijoDePrecio(precio) : flexFijoDePrecio(precio);
}

/**
 * Costo de envío / logística ML que asume el vendedor a un precio de venta dado
 * (misma estructura que el motor de precio objetivo: % sobre P + tramo fijo).
 */
export function calcShippingCostAtPrice(logistica: LogisticaType, precio: number): number {
  if (logistica === "Retiro domicilio") return 0;
  return mlLogisticsVariableRate(logistica) * precio + mlLogisticsFixedAtPrice(logistica, precio);
}

export function calcMlLogisticsSplit(
  logistica: LogisticaType,
  precio: number
): { mlShippingAmount: number; fulfillmentAmount: number } {
  if (logistica === "Retiro domicilio") return { mlShippingAmount: 0, fulfillmentAmount: 0 };
  const mlShippingAmount = Math.round(mlLogisticsVariableRate(logistica) * precio * 100) / 100;
  const fulfillmentAmount = Math.round(mlLogisticsFixedAtPrice(logistica, precio) * 100) / 100;
  return { mlShippingAmount, fulfillmentAmount };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function pctOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return normalizePct(v);
}

function shippingBreakdownFromEstimate(est: ShippingCostEstimate): FinancialCostBreakdown["shipping"] {
  return {
    sellerShippingCost: est.sellerShippingCost,
    source: est.source,
    completeness: est.completeness,
    priceBand: est.priceBand,
    weightBand: est.weightBand,
    reputationGroup: est.reputationGroup,
    missing: [...est.missing],
    reasons: [...est.reasons]
  };
}

function emptyShippingBreakdown(): FinancialCostBreakdown["shipping"] {
  return {
    sellerShippingCost: null,
    source: "missing_data",
    completeness: "partial",
    priceBand: null,
    weightBand: null,
    reputationGroup: "unknown",
    missing: [],
    reasons: []
  };
}

/**
 * Desglose de costos y ganancia neta (única fuente de verdad para trazabilidad en UI).
 * IIBB / impuestos / costos adicionales no configurados → `amount`/`pct` null y entradas en `missing` (no se asume 0).
 */
export function calculateFinancialCostBreakdown(input: {
  salePrice: number;
  productCost: number | null;
  logistica: LogisticaType;
  reputacion: ReputacionType | string | null | undefined;
  /** null/undefined → 0% ads (INVARIANT-04). */
  publicidad_pct: number | null | undefined;
  financialSettings: SellerFinancialSettings | null | undefined;
  skuAdditionalFixedCost: number | null | undefined;
  /** Costo de envío absorbido (AR tabla / política envío gratis). Omisión → freeShipping=false. */
  shipping?: Omit<ShippingCostInput, "price">;
  /** Costo interno Flex por SKU (prioridad sobre cuenta). */
  rowInternalLogisticsCost?: number | null;
}): FinancialCostBreakdown {
  const reasons: string[] = [];
  const missing: string[] = [];
  const { salePrice: P, logistica } = input;

  if (!Number.isFinite(P) || P <= 0) {
    reasons.push("Precio de venta inválido o no informado.");
    const lo = resolveLogisticsOperatingCostBreakdown({
      logistica: input.logistica,
      financialSettings: input.financialSettings ?? null,
      rowInternalLogisticsCost: input.rowInternalLogisticsCost
    });
    return {
      productCost: null,
      mlFeeAmount: null,
      mlFeePct: null,
      fixedUnitCost: null,
      adsAmount: 0,
      adsPct: 0,
      iibbAmount: null,
      iibbPct: null,
      taxAmount: null,
      taxPct: null,
      mlShippingAmount: null,
      fulfillmentAmount: null,
      internalLogisticsAmount: null,
      logisticsOperatingAmount: null,
      logisticsOperating: lo,
      additionalCostsAmount: null,
      totalCost: null,
      netProfit: null,
      netMarginPct: null,
      shipping: emptyShippingBreakdown(),
      reasons,
      missing: ["price"]
    };
  }

  const fs = input.financialSettings ?? null;
  const comisionRate = mlComisionRate(input.reputacion);
  reasons.push(`Comisión ML ${(comisionRate * 100).toFixed(2)}% según reputación.`);

  const pubExplicit = input.publicidad_pct !== null && input.publicidad_pct !== undefined;
  const adsPct = pubExplicit ? normalizePct(input.publicidad_pct) : 0;
  if (!pubExplicit) {
    reasons.push("Publicidad: sin % informado → 0% (ACOS no modelado).");
  } else {
    reasons.push(`Publicidad: ${(adsPct * 100).toFixed(2)}% sobre precio de venta.`);
  }
  const adsAmount = roundMoney(P * adsPct);

  const iibbPct = fs?.iibbPct === null || fs?.iibbPct === undefined ? null : pctOrNull(fs.iibbPct);
  const taxPct = fs?.taxPct === null || fs?.taxPct === undefined ? null : pctOrNull(fs.taxPct);

  const logisticsOperating = resolveLogisticsOperatingCostBreakdown({
    logistica: input.logistica,
    financialSettings: fs,
    rowInternalLogisticsCost: input.rowInternalLogisticsCost
  });
  for (const r of logisticsOperating.reasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }
  for (const m of logisticsOperating.missing) {
    const tag = `logistics_${m}`;
    if (!missing.includes(tag)) missing.push(tag);
  }

  const logisticsOperatingSubtract =
    logisticsOperating.completeness === "complete" &&
    logisticsOperating.operatingCost !== null &&
    Number.isFinite(logisticsOperating.operatingCost)
      ? roundMoney(logisticsOperating.operatingCost)
      : 0;

  const logisticsOperatingAmount =
    logisticsOperating.completeness === "complete" &&
    logisticsOperating.operatingCost !== null &&
    Number.isFinite(logisticsOperating.operatingCost)
      ? logisticsOperating.source === "retire_no_cost"
        ? null
        : roundMoney(logisticsOperating.operatingCost)
      : null;

  const internalLogisticsAmount =
    logisticsOperatingSubtract > 0 ? logisticsOperatingSubtract : null;

  const fixedUnitRaw = fs?.fixedUnitCost;
  const fixedUnitCost =
    fixedUnitRaw === null || fixedUnitRaw === undefined || !Number.isFinite(fixedUnitRaw)
      ? null
      : roundMoney(fixedUnitRaw);
  if (fixedUnitCost !== null) reasons.push("Costo fijo por unidad (no ML) configurado.");

  let iibbAmount: number | null = null;
  if (iibbPct === null) {
    missing.push("iibb");
    reasons.push("IIBB: no configurado → no se incluye en costo total.");
  } else {
    iibbAmount = roundMoney(P * iibbPct);
    reasons.push(`IIBB: ${(iibbPct * 100).toFixed(2)}% sobre precio de venta.`);
  }

  let taxAmount: number | null = null;
  if (taxPct === null) {
    missing.push("tax");
    reasons.push("Impuestos adicionales: no configurados → no se incluyen en costo total.");
  } else {
    taxAmount = roundMoney(P * taxPct);
    reasons.push(`Impuestos: ${(taxPct * 100).toFixed(2)}% sobre precio de venta.`);
  }

  const addPct = fs?.additionalCostsPct === null || fs?.additionalCostsPct === undefined ? null : pctOrNull(fs.additionalCostsPct);
  const addFixedAcct =
    fs?.additionalCostsFixed === null || fs?.additionalCostsFixed === undefined || !Number.isFinite(fs.additionalCostsFixed)
      ? null
      : roundMoney(fs.additionalCostsFixed);
  const skuAdd =
    input.skuAdditionalFixedCost === null ||
    input.skuAdditionalFixedCost === undefined ||
    !Number.isFinite(input.skuAdditionalFixedCost)
      ? null
      : roundMoney(input.skuAdditionalFixedCost);

  const addFromPct = addPct !== null ? roundMoney(P * addPct) : null;
  if (addPct !== null) reasons.push(`Costos adicionales: ${(addPct * 100).toFixed(2)}% sobre precio.`);
  if (addFixedAcct !== null) reasons.push("Costos adicionales: monto fijo por unidad (cuenta).");
  if (skuAdd !== null) reasons.push("Costos adicionales: monto fijo por unidad (SKU).");

  let additionalCostsAmount: number | null = null;
  const addParts: number[] = [];
  if (addFromPct !== null) addParts.push(addFromPct);
  if (addFixedAcct !== null) addParts.push(addFixedAcct);
  if (skuAdd !== null) addParts.push(skuAdd);
  if (addParts.length) {
    additionalCostsAmount = roundMoney(addParts.reduce((a, b) => a + b, 0));
  } else {
    reasons.push("Costos adicionales: sin porcentaje ni montos fijos configurados (monto no aplicado).");
  }

  const sh = input.shipping;
  const shipInput: ShippingCostInput =
    sh === undefined
      ? {
          price: P,
          packageWeightKg: null,
          reputation: "unknown",
          shippingMode: "unknown",
          freeShipping: false,
          condition: "unknown"
        }
      : {
          price: P,
          packageWeightKg: sh.packageWeightKg ?? null,
          reputation: sh.reputation,
          shippingMode: sh.shippingMode,
          freeShipping: sh.freeShipping,
          condition: sh.condition
        };

  const shipEst = estimateSellerShippingCostAr(shipInput);
  const shipBreakdown = shippingBreakdownFromEstimate(shipEst);

  for (const m of shipEst.missing) {
    const tag = `shipping_${m}`;
    if (!missing.includes(tag)) missing.push(tag);
  }

  const shipSubtract =
    shipEst.source === "buyer_pays_shipping"
      ? 0
      : shipEst.completeness === "complete" &&
          shipEst.sellerShippingCost !== null &&
          Number.isFinite(shipEst.sellerShippingCost)
        ? roundMoney(shipEst.sellerShippingCost)
        : 0;

  for (const r of shipEst.reasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  const mlShippingOut: number | null =
    shipEst.source === "buyer_pays_shipping"
      ? 0
      : shipEst.completeness === "complete" && shipEst.sellerShippingCost !== null
        ? roundMoney(shipEst.sellerShippingCost)
        : null;
  const fulfillmentOut: number | null = null;

  const mlFeeAmount = roundMoney(P * comisionRate);
  const productCost =
    input.productCost === null || input.productCost === undefined || !Number.isFinite(input.productCost)
      ? null
      : roundMoney(input.productCost);
  if (productCost !== null) reasons.push("Costo de producto informado por SKU.");

  const mlFeePct = comisionRate;

  if (productCost === null) {
    missing.push("product_cost");
    return {
      productCost: null,
      mlFeeAmount,
      mlFeePct,
      fixedUnitCost,
      adsAmount,
      adsPct,
      iibbAmount,
      iibbPct,
      taxAmount,
      taxPct,
      mlShippingAmount: mlShippingOut,
      fulfillmentAmount: fulfillmentOut,
      internalLogisticsAmount,
      logisticsOperatingAmount,
      logisticsOperating,
      additionalCostsAmount,
      totalCost: null,
      netProfit: null,
      netMarginPct: null,
      shipping: shipBreakdown,
      reasons,
      missing
    };
  }

  const parts: number[] = [productCost, mlFeeAmount, adsAmount, shipSubtract];
  if (fixedUnitCost !== null) parts.push(fixedUnitCost);
  if (iibbAmount !== null) parts.push(iibbAmount);
  if (taxAmount !== null) parts.push(taxAmount);
  if (logisticsOperatingSubtract > 0) parts.push(logisticsOperatingSubtract);
  if (additionalCostsAmount !== null) parts.push(additionalCostsAmount);

  const totalCost = roundMoney(parts.reduce((a, b) => a + b, 0));
  const netProfit = roundMoney(P - totalCost);
  const netMarginPct = roundMoney((netProfit / P) * 10_000) / 10_000;

  return {
    productCost,
    mlFeeAmount,
    mlFeePct,
    fixedUnitCost,
    adsAmount,
    adsPct,
    iibbAmount,
    iibbPct,
    taxAmount,
    taxPct,
    mlShippingAmount: mlShippingOut,
    fulfillmentAmount: fulfillmentOut,
    internalLogisticsAmount,
    logisticsOperatingAmount,
    logisticsOperating,
    additionalCostsAmount,
    totalCost,
    netProfit,
    netMarginPct,
    shipping: shipBreakdown,
    reasons,
    missing
  };
}

export type SellingPriceInput = Pick<MargenesRow, "costo" | "logistica" | "publicidad_pct" | "margen_pct"> & {
  reputacion?: ReputacionType | string | null;
  financialSettings?: SellerFinancialSettings | null;
  /** Costo fijo adicional por SKU (misma semántica que `buildSkuDecisionState` inputs.additionalCosts). */
  skuAdditionalFixedCost?: number | null;
  /** Costo de envío absorbido por el vendedor a un precio candidato (tabla AR); sin callback → 0. */
  sellerShippingAtPrice?: (precio: number) => number;
  /** Costo interno Flex por SKU (prioridad sobre cuenta). */
  rowInternalLogisticsCost?: number | null;
};

export type SellingPriceResult = {
  precio_venta: number;
  ganancia_unit: number;
  roi: number;
  converged: boolean;
};

function sellingFinancialRates(fs: SellerFinancialSettings | null | undefined): number {
  if (!fs) return 0;
  const i = fs.iibbPct === null || fs.iibbPct === undefined ? 0 : normalizePct(fs.iibbPct);
  const t = fs.taxPct === null || fs.taxPct === undefined ? 0 : normalizePct(fs.taxPct);
  const a = fs.additionalCostsPct === null || fs.additionalCostsPct === undefined ? 0 : normalizePct(fs.additionalCostsPct);
  return i + t + a;
}

function sellingFixedExtras(
  logistica: LogisticaType,
  fs: SellerFinancialSettings | null | undefined,
  skuAdditionalFixedCost: number | null | undefined,
  rowInternalLogisticsCost?: number | null
): number {
  let s = 0;
  if (fs?.fixedUnitCost !== null && fs?.fixedUnitCost !== undefined && Number.isFinite(fs.fixedUnitCost)) s += fs.fixedUnitCost;
  const lo = resolveLogisticsOperatingCostBreakdown({
    logistica,
    financialSettings: fs,
    rowInternalLogisticsCost
  });
  if (lo.completeness === "complete" && lo.operatingCost !== null && Number.isFinite(lo.operatingCost)) {
    s += roundMoney(lo.operatingCost);
  }
  if (fs?.additionalCostsFixed !== null && fs?.additionalCostsFixed !== undefined && Number.isFinite(fs.additionalCostsFixed)) {
    s += fs.additionalCostsFixed;
  }
  if (skuAdditionalFixedCost !== null && skuAdditionalFixedCost !== undefined && Number.isFinite(skuAdditionalFixedCost)) {
    s += skuAdditionalFixedCost;
  }
  return s;
}

/**
 * Resuelve precio de venta objetivo a partir de costo, comisión (por reputación), envío, ads, cargas fiscales configuradas y margen.
 * `publicidad_pct` y `margen_pct` pueden venir en 0–1 o 0–100; se normalizan con `normalizePct`.
 * Tasas fiscales / IIBB / adicionales % omitidas (null) no entran en el denominador (mismo criterio que ganancia parcial).
 */
export function calcSellingPrice(input: SellingPriceInput): SellingPriceResult {
  const { costo } = input;
  const pub = normalizePct(input.publicidad_pct);
  const marg = normalizePct(input.margen_pct ?? 0.15) || 0.15;
  const comision = mlComisionRate(input.reputacion);
  const fs = input.financialSettings ?? null;
  const extraRate = sellingFinancialRates(fs);
  const fixedExtras = sellingFixedExtras(input.logistica, fs, input.skuAdditionalFixedCost, input.rowInternalLogisticsCost);
  const shipAt = input.sellerShippingAtPrice ?? ((_p: number) => 0);

  if (costo <= 0) {
    return { precio_venta: 0, ganancia_unit: 0, roi: 0, converged: true };
  }

  const sumRates = () => 1 - comision - pub - marg - extraRate;

  let p = costo * 1.4;
  let converged = false;
  for (let i = 0; i < 45; i += 1) {
    const absorbed = shipAt(p);
    const d = sumRates();
    if (d <= 0.001) {
      return { precio_venta: Number.NaN, ganancia_unit: 0, roi: 0, converged: false };
    }
    const pNext = (costo + fixedExtras + absorbed) / d;
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
  breakdown: FinancialCostBreakdown;
}

export type CalcRealProfitInput = {
  price_ml: number;
  /** Costo unitario del producto (sin sumar adicionales; van por breakdown). */
  productCost: number;
  logistica: LogisticaType;
  reputacion: ReputacionType | string | null | undefined;
  /** null/undefined → 0% ads (INVARIANT-04). */
  publicidad_pct?: number | null;
  peso_kg: number | null;
  financialSettings?: SellerFinancialSettings | null;
  skuAdditionalFixedCost?: number | null;
  shipping?: Omit<ShippingCostInput, "price">;
  rowInternalLogisticsCost?: number | null;
};

/**
 * Ganancia neta del vendedor al precio actual de ML.
 * `envio_$` = costo de envío absorbido (`shipping` estimación AR); no mezcla modo logístico con política de gratis.
 */
export function calcRealProfit(input: CalcRealProfitInput): RealProfitResult {
  const { price_ml, productCost, logistica } = input;
  const shippingMerged: ShippingCostInput | undefined =
    input.shipping === undefined
      ? undefined
      : {
          ...input.shipping,
          price: price_ml
        };
  const breakdown = calculateFinancialCostBreakdown({
    salePrice: price_ml,
    productCost,
    logistica,
    reputacion: input.reputacion,
    publicidad_pct: input.publicidad_pct,
    financialSettings: input.financialSettings ?? null,
    skuAdditionalFixedCost: input.skuAdditionalFixedCost ?? null,
    shipping: shippingMerged,
    rowInternalLogisticsCost: input.rowInternalLogisticsCost
  });

  if (!Number.isFinite(price_ml) || price_ml <= 0 || !Number.isFinite(productCost) || productCost < 0) {
    return {
      ganancia_real: Number.NaN,
      margen_real: Number.NaN,
      comision_$: Number.NaN,
      envio_$: Number.NaN,
      publicidad_$: Number.NaN,
      costo_total: productCost,
      converged: false,
      breakdown
    };
  }

  const envio_$ =
    breakdown.mlShippingAmount !== null && Number.isFinite(breakdown.mlShippingAmount)
      ? roundMoney(breakdown.mlShippingAmount)
      : Number.NaN;
  const comision_$ = breakdown.mlFeeAmount ?? Number.NaN;
  const publicidad_$ = breakdown.adsAmount;
  const costo_total = breakdown.productCost ?? productCost;
  const ganancia_real = breakdown.netProfit ?? Number.NaN;
  const margen_real = breakdown.netMarginPct ?? Number.NaN;

  return {
    ganancia_real,
    margen_real,
    comision_$,
    envio_$,
    publicidad_$,
    costo_total,
    converged:
      Number.isFinite(ganancia_real) &&
      Number.isFinite(margen_real) &&
      breakdown.netProfit !== null &&
      breakdown.netMarginPct !== null,
    breakdown
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
