import {
  calcRealProfit,
  calcSellingPrice,
  calculateFinancialCostBreakdown,
  coerceReputacion,
  normalizePct,
  type FinancialCostBreakdown,
  type LogisticaType,
  type SellerFinancialSettings
} from "@/lib/pricing/calculator";
import {
  estimateSellerShippingCostAr,
  parseMlItemCondition,
  resolveSellerReputationForRow,
  shippingModeToOperatorLogistica,
  type ShippingCostInput,
  type ShippingMode
} from "@/lib/pricing/shipping-costs-argentina";
import { resolveLogisticsOperatingCostBreakdown } from "@/lib/pricing/logistics-operating-cost";
import { deriveSellerReputationStateFromPersistedAccount, type SellerReputationState } from "@/lib/pricing/seller-reputation-state";
import {
  buildSkuFieldSources,
  normalizeOfficialShippingMode,
  type FieldSource,
  type SkuFieldSources
} from "@/lib/pricing/ml-official-data-contract";

/** V3 forced single action — derived only from `SkuDecisionStateBase` (no recomputation). */
export type SkuBusinessDecision = {
  type:
    | "configure_cost"
    | "configure_fiscal"
    | "complete_shipping_data"
    | "fix_shipping"
    | "fix_price"
    | "replenish_stock"
    | "hold";
  priority: "critical" | "high" | "medium" | "low";
  message: string;
  action: string;
  impactAmount: number | null;
};

export type SkuDecisionStateBase = {
  ml: {
    accountId: string;
    itemId: string | null;
    sku: string | null;
    title: string;
    imageUrl: string | null;
    currentPrice: number | null;
    stock: number | null;
    ventas30d: number | null;
    revenue30d: number | null;
    lastSaleDate: string | null;
    shippingMode: string | null;
    freeShipping: boolean | null;
    categoryId: string | null;
    listingType: string | null;
    /** Condición publicación ML — tabla envío solo `new`. */
    condition: string | null;
    packageWeightKg: number | null;
  };

  inputs: {
    productCost: number | null;
    logistics: string | null;
    publicidadPct: number;
    targetMarginPct: number | null;
    safetyStockPct: number;
    taxPct: number | null;
    iibbPct: number | null;
    additionalCosts: number | null;
  };

  computed: {
    optimalPrice: number | null;
    /** Ganancia unitaria al precio óptimo (mismo `calcSellingPrice` que fija optimalPrice). */
    optimalGananciaUnit: number | null;
    optimalRoi: number | null;
    /** Ganancia neta coherente con `financialBreakdown` (mismo número que `financialBreakdown.netProfit`). */
    realProfit: number | null;
    realMarginPct: number | null;
    realComisionAmount: number | null;
    realShippingAmount: number | null;
    realAdsAmount: number | null;
    realProductCostApplied: number | null;
    financialBreakdown: FinancialCostBreakdown | null;
    /** Precio ML menos retenciones marketplace (`financialBreakdown.cashInAmount`). */
    cashInAmount: number | null;
    /** `net_full` = IIBB e impuestos explícitos en configuración; `net_partial` = falta al menos uno. */
    profitCompleteness: "net_full" | "net_partial" | null;
    breakEvenPrice: number | null;
    priceDelta: number | null;
    idealStock: number | null;
    stockGap: number | null;
    velocity30d: number | null;
    daysOfStock: number | null;
  };

  decision: {
    profitabilityStatus: "healthy" | "low_margin" | "risk" | "loss" | "unknown";
    stockStatus: "critical" | "replenish" | "healthy" | "overstock" | "syncing" | "unknown";
    pricingStatus: "below_break_even" | "acceptable" | "optimize" | "unknown";
    priorityScore: number;
    primaryInsight: string | null;
    recommendedAction: string | null;
    /** Señales solo envío (≤8 palabras / ≤12 palabras acción). */
    shippingMessage: string | null;
    shippingAction: string | null;
  };

  sync: {
    calculationStatus: "valid" | "partial" | "missing_inputs" | "error";
  };

  /** Contrato de datos: fuente por campo clave (precio / envío / decisiones). */
  fieldSources: SkuFieldSources;
};

export type SkuDecisionState = SkuDecisionStateBase & {
  businessDecision: SkuBusinessDecision;
};

export type BuildSkuDecisionStateInput = {
  accountId: string;
  /** Config financiera de cuenta (sin persistencia obligatoria). */
  financialSettings?: SellerFinancialSettings | null;
  /** Procedencia de `ml.freeShipping` luego de resolución catálogo (ML API + simulación explícita de sesión). */
  freeShippingSource?: FieldSource;
  ml: {
    itemId?: string | null;
    sku?: string | null;
    title?: string | null;
    imageUrl?: string | null;
    currentPrice?: number | null;
    stock?: number | null;
    ventas30d?: number | null;
    revenue30d?: number | null;
    lastSaleDate?: string | null;
    shippingMode?: string | null;
    freeShipping?: boolean | null;
    categoryId?: string | null;
    listingType?: string | null;
    condition?: string | null;
    packageWeightKg?: number | null;
    /** ML `shipping.logistic_type` (texto crudo) — solo trazas / envío, sin inferir `freeShipping`. */
    logisticType?: string | null;
  };
  /** Reputación vendedor ML (API/sync + fallback pricing). */
  accountReputation?: {
    sellerReputationLevel: string | null;
    sellerPowerSellerStatus: string | null;
    sellerReputationSyncedAt: string | null;
  };
  inputs: {
    productCost?: number | null;
    logistics?: string | null;
    publicidadPct?: number | null;
    targetMarginPct?: number | null;
    safetyStockPct?: number | null;
    taxPct?: number | null;
    iibbPct?: number | null;
    additionalCosts?: number | null;
    reputacion?: string | null;
    pesoKg?: number | null;
    /** Costo interno Flex por unidad (SKU); prioridad sobre cuenta. */
    rowInternalLogisticsCost?: number | null;
  };
};

function operatorLogisticaFromMl(input: BuildSkuDecisionStateInput): LogisticaType {
  const raw = input.inputs.logistics;
  if (raw === "Full" || raw === "Flex" || raw === "Retiro domicilio") return raw;
  const mode = normalizeOfficialShippingMode(input.ml.logisticType ?? null, input.ml.shippingMode ?? null);
  return shippingModeToOperatorLogistica(mode);
}

function mergeSellerFinancialSettings(
  financial: SellerFinancialSettings | null | undefined,
  taxPctInput: number | null | undefined,
  iibbPctInput: number | null | undefined
): SellerFinancialSettings {
  const base = financial ?? null;
  const taxPct =
    taxPctInput !== null && taxPctInput !== undefined && Number.isFinite(taxPctInput)
      ? taxPctInput
      : (base?.taxPct ?? null);
  const iibbPct =
    iibbPctInput !== null && iibbPctInput !== undefined && Number.isFinite(iibbPctInput)
      ? iibbPctInput
      : (base?.iibbPct ?? null);
  return {
    iibbPct,
    taxPct,
    internalLogisticsCost: base?.internalLogisticsCost ?? null,
    fixedUnitCost: base?.fixedUnitCost ?? null,
    additionalCostsPct: base?.additionalCostsPct ?? null,
    additionalCostsFixed: base?.additionalCostsFixed ?? null,
    fullFulfillmentCostPerUnit: base?.fullFulfillmentCostPerUnit ?? null,
    fullStorageCostPerUnit: base?.fullStorageCostPerUnit ?? null,
    fullInboundCostPerUnit: base?.fullInboundCostPerUnit ?? null
  };
}

function netProfitCompleteFromBreakdown(b: FinancialCostBreakdown | null, freeShipping: boolean | null): boolean {
  if (!b) return false;
  const fiscalOk = !b.missing.includes("iibb") && !b.missing.includes("tax");
  const logisticsOk =
    b.logisticsOperating.completeness === "complete" || b.logisticsOperating.source === "retire_no_cost";
  if (!logisticsOk) return false;
  if (freeShipping === false) {
    return fiscalOk;
  }
  if (freeShipping === null) {
    return false;
  }
  return (
    fiscalOk &&
    b.shipping.completeness === "complete" &&
    b.shipping.sellerShippingCost !== null &&
    Number.isFinite(b.shipping.sellerShippingCost)
  );
}

function normalizeCurrentPrice(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

function normalizeStock(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return v;
}

function normalizeVentas30d(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return v;
}

/**
 * Precio de equilibrio (ganancia ≈ 0) usando solo `calcRealProfit` como fuente numérica.
 */
function solveBreakEvenPrice(
  productCost: number,
  skuAdditionalFixedCost: number | null,
  financialMerged: SellerFinancialSettings,
  logistica: LogisticaType,
  rep: string,
  publicidadPct: number | null | undefined,
  shippingOmit: () => Omit<ShippingCostInput, "price">,
  rowInternalLogisticsCost: number | null
): number | null {
  if (!Number.isFinite(productCost) || productCost <= 0) return null;

  const profitAt = (p: number) =>
    calcRealProfit({
      price_ml: p,
      productCost,
      logistica,
      reputacion: rep,
      publicidad_pct: publicidadPct,
      peso_kg: null,
      financialSettings: financialMerged,
      skuAdditionalFixedCost,
      shipping: shippingOmit(),
      rowInternalLogisticsCost
    });

  let hi = Math.max(500, productCost * 4);
  let foundPositive = false;
  for (let expand = 0; expand < 40; expand += 1) {
    const r = profitAt(hi);
    if (r.converged && Number.isFinite(r.ganancia_real) && r.ganancia_real >= 0) {
      foundPositive = true;
      break;
    }
    hi *= 1.6;
    if (hi > 99_000_000) return null;
  }
  if (!foundPositive) return null;

  let lo = 1;
  let up = hi;
  for (let i = 0; i < 55; i += 1) {
    const mid = (lo + up) / 2;
    const r = profitAt(mid);
    if (!r.converged || !Number.isFinite(r.ganancia_real)) return null;
    if (r.ganancia_real >= 0) up = mid;
    else lo = mid;
  }
  return Math.round(up * 100) / 100;
}

function computeStockBranch(input: {
  ventas30d: number | null;
  stock: number | null;
  safetyStockPct: number;
}): {
  velocity30d: number | null;
  idealStock: number | null;
  stockGap: number | null;
  daysOfStock: number | null;
  stockStatus: SkuDecisionState["decision"]["stockStatus"];
} {
  const { ventas30d, stock, safetyStockPct } = input;

  if (ventas30d === null) {
    return {
      velocity30d: null,
      idealStock: null,
      stockGap: null,
      daysOfStock: null,
      stockStatus: "syncing"
    };
  }

  if (ventas30d === 0) {
    return {
      velocity30d: 0,
      idealStock: 0,
      stockGap: stock === null ? null : 0 - stock,
      daysOfStock: null,
      stockStatus: "unknown"
    };
  }

  const velocity30d = ventas30d / 30;
  const idealStock = ventas30d * (1 + safetyStockPct);
  const stockGap = stock === null ? null : idealStock - stock;
  const daysOfStock =
    stock === null || velocity30d <= 0 || !Number.isFinite(stock / velocity30d)
      ? null
      : Math.round((stock / velocity30d) * 100) / 100;

  if (stock === null) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "unknown" };
  }

  if (stock > idealStock * 2) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "overstock" };
  }

  if (daysOfStock !== null && daysOfStock < 3) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "critical" };
  }

  if (daysOfStock !== null && daysOfStock < 7) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "replenish" };
  }

  if (stockGap !== null && stockGap <= 0) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "healthy" };
  }

  if (stockGap !== null && stockGap > 0) {
    return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "replenish" };
  }

  return { velocity30d, idealStock, stockGap, daysOfStock, stockStatus: "healthy" };
}

function profitabilityFromReal(
  realProfit: number | null,
  realMarginPct: number | null,
  targetMarginPct: number | null,
  fiscalNetComplete: boolean
): SkuDecisionState["decision"]["profitabilityStatus"] {
  if (realProfit === null || realMarginPct === null) return "unknown";
  if (realProfit < 0) return "loss";
  if (realMarginPct < 0) return "loss";
  if (realMarginPct < 0.1) return "risk";
  if (!fiscalNetComplete) {
    return "low_margin";
  }
  if (targetMarginPct !== null && Number.isFinite(targetMarginPct) && realMarginPct < targetMarginPct) {
    return "low_margin";
  }
  return "healthy";
}

function pricingStatusFrom(
  targetMarginPct: number | null,
  optimalPrice: number | null,
  currentPrice: number | null,
  breakEvenPrice: number | null,
  sellConverged: boolean
): SkuDecisionState["decision"]["pricingStatus"] {
  if (targetMarginPct === null || optimalPrice === null || !sellConverged) return "unknown";

  if (breakEvenPrice !== null && currentPrice !== null && currentPrice < breakEvenPrice) {
    return "below_break_even";
  }

  if (currentPrice !== null && optimalPrice !== null && Number.isFinite(currentPrice) && Number.isFinite(optimalPrice)) {
    const rel = Math.abs(currentPrice - optimalPrice) / optimalPrice;
    if (rel > 0.02) return "optimize";
  }

  return "acceptable";
}

function unitsToReorder(stockGap: number | null): number {
  if (stockGap === null || !Number.isFinite(stockGap)) return 0;
  return Math.max(0, Math.ceil(stockGap));
}

function fiscalInsightFromMissing(missing: string[]): string | null {
  const hasI = missing.includes("iibb");
  const hasT = missing.includes("tax");
  if (!hasI && !hasT) return null;
  if (hasI && hasT) return "Margen parcial: faltan IIBB e impuestos para calcular ganancia neta real.";
  if (hasI) return "Margen parcial: faltan IIBB para calcular ganancia neta real.";
  return "Margen parcial: faltan impuestos para calcular ganancia neta real.";
}

function pickPrimaryInsight(input: {
  profitabilityStatus: SkuDecisionState["decision"]["profitabilityStatus"];
  pricingStatus: SkuDecisionState["decision"]["pricingStatus"];
  stockStatus: SkuDecisionState["decision"]["stockStatus"];
  publicidadPct: number;
  realProfit: number | null;
  breakEvenPrice: number | null;
  currentPrice: number | null;
  optimalPrice: number | null;
  targetMarginPct: number | null;
  stockGap: number | null;
  fiscalNetComplete: boolean;
  breakdownMissing: string[];
  realMarginPct: number | null;
}): { insight: string | null; action: string | null } {
  const {
    profitabilityStatus,
    pricingStatus,
    stockStatus,
    publicidadPct,
    realProfit,
    breakEvenPrice,
    currentPrice,
    optimalPrice,
    targetMarginPct,
    stockGap,
    fiscalNetComplete,
    breakdownMissing,
    realMarginPct
  } = input;

  const reorder = unitsToReorder(stockGap);

  if (profitabilityStatus === "loss") {
    const hint =
      optimalPrice !== null && Number.isFinite(optimalPrice)
        ? ` Revisá costo o subir precio hacia ${Math.round(optimalPrice).toLocaleString("es-AR")}.`
        : " Revisá costo o subir precio.";
    const fiscalNote = !fiscalNetComplete
      ? " Resultado parcial: completá IIBB e impuestos para ver rentabilidad neta real."
      : "";
    return {
      insight: `Pierde plata al precio actual.${fiscalNote}${hint}`,
      action: "Ajustar precio o costo antes de escalar ventas."
    };
  }

  if (pricingStatus === "below_break_even" && breakEvenPrice !== null && currentPrice !== null) {
    const beNote = !fiscalNetComplete ? " Break-even parcial (sin fiscal completo)." : "";
    return {
      insight: `Precio por debajo del punto de equilibrio (~$${Math.round(breakEvenPrice).toLocaleString("es-AR")}).${beNote}`,
      action: "Subir precio por encima del break-even o bajar costos."
    };
  }

  if (!fiscalNetComplete && realProfit !== null && realProfit >= 0) {
    const fi = fiscalInsightFromMissing(breakdownMissing);
    if (fi) {
      return {
        insight: fi,
        action: "Falta configurar IIBB para medir rentabilidad real."
      };
    }
  }

  if (stockStatus === "critical") {
    return {
      insight:
        reorder > 0
          ? `Stock crítico. Reponer ${reorder} unidades para alcanzar nivel de seguridad.`
          : "Stock crítico. Revisá disponibilidad y reposición.",
      action: "Priorizar reposición o ajuste de publicación."
    };
  }

  if (profitabilityStatus === "low_margin" || profitabilityStatus === "risk") {
    const tgt =
      targetMarginPct !== null ? `${(targetMarginPct * 100).toFixed(1)}%` : "objetivo";
    if (!fiscalNetComplete) {
      return {
        insight: `${fiscalInsightFromMissing(breakdownMissing) ?? "Margen parcial."} Además, el margen queda bajo el ${tgt}.`,
        action: "Completar configuración fiscal y revisar precio."
      };
    }
    return {
      insight: `Margen neto bajo objetivo (${tgt}).`,
      action: optimalPrice !== null ? "Revisar precio óptimo vs. precio ML." : "Completar margen objetivo y costo para ver precio óptimo."
    };
  }

  if (profitabilityStatus === "healthy" && publicidadPct === 0 && realProfit !== null && realProfit > 0) {
    return {
      insight: "SKU rentable sin Ads. Evaluar activar campaña.",
      action: "Evaluar publicidad incremental con control de ACOS."
    };
  }

  if (stockStatus === "overstock") {
    return {
      insight: "Stock por encima del nivel ideal. Evaluar promos o pausar compras.",
      action: "Alinear compras con demanda reciente."
    };
  }

  if (profitabilityStatus === "healthy" && stockStatus === "healthy") {
    return {
      insight: "Rentabilidad y stock alineados con la demanda reciente.",
      action: "Mantener monitoreo semanal."
    };
  }

  if (stockStatus === "syncing") {
    return {
      insight: "Esperando datos de ventas 30d para evaluar stock.",
      action: "Sincronizar catálogo / ventas."
    };
  }

  return { insight: null, action: null };
}

function priorityScoreFrom(input: {
  profitabilityStatus: SkuDecisionState["decision"]["profitabilityStatus"];
  pricingStatus: SkuDecisionState["decision"]["pricingStatus"];
  stockStatus: SkuDecisionState["decision"]["stockStatus"];
  publicidadPct: number;
  realProfit: number | null;
}): number {
  let score = 0;
  const { profitabilityStatus, pricingStatus, stockStatus, publicidadPct, realProfit } = input;

  if (profitabilityStatus === "loss") score += 10_000;
  if (pricingStatus === "below_break_even") score += 8_000;
  if (stockStatus === "critical") score += 6_000;
  if (profitabilityStatus === "risk" || profitabilityStatus === "low_margin") score += 4_000;
  if (profitabilityStatus === "healthy" && publicidadPct === 0 && realProfit !== null && realProfit > 0) score += 2_000;
  if (stockStatus === "overstock") score += 1_000;
  if (stockStatus === "replenish") score += 500;
  if (stockStatus === "syncing") score += 100;
  if (profitabilityStatus === "healthy" && stockStatus === "healthy") score += 50;
  return score;
}

function pickShippingShortSignal(
  freeShipping: boolean | null,
  breakdown: FinancialCostBreakdown | null,
  shippingModeNorm: ShippingMode,
  accountReputationState: SellerReputationState
): { msg: string | null; action: string | null } {
  if (!breakdown) return { msg: null, action: null };
  const mode = shippingModeNorm;
  if (freeShipping === false) return { msg: null, action: null };
  if (freeShipping === null) {
    return { msg: "Falta dato de envío", action: "Definir envío gratis" };
  }
  if (mode === "retire" && freeShipping === true) {
    return { msg: "No soporta envío gratis", action: "Quitar envío gratis o subir precio" };
  }
  if (breakdown.shipping.source === "missing_reputation") {
    return { msg: "Falta reputación ML sincronizada", action: "Sincronizar cuenta" };
  }
  if (breakdown.shipping.source === "missing_table") {
    return { msg: "Tabla de envío no disponible", action: "Cargar tabla para esta reputación" };
  }
  if (breakdown.missing.some((m) => m === "shipping_package_weight" || m.includes("package_weight"))) {
    return { msg: "Falta peso del paquete", action: "Completar peso para estimar envío" };
  }
  if (
    breakdown.missing.some((m) => String(m).includes("ml_reputation_sync"))
  ) {
    return { msg: "Falta reputación ML sincronizada", action: "Sincronizar cuenta" };
  }
  if (
    accountReputationState !== "no_reputation" &&
    breakdown.missing.some((m) => m === "shipping_ml_reputation" || (String(m).includes("ml_reputation") && !String(m).includes("sync")))
  ) {
    return { msg: "Falta reputación ML", action: "Sincronizar reputación de cuenta" };
  }
  return { msg: null, action: null };
}

/**
 * V3 enterprise decision: exactly one outcome, strict precedence graph (directive).
 * Read-only on orchestration outputs — no calculator / shipping / API calls.
 */
export function deriveSkuBusinessDecision(state: SkuDecisionStateBase): SkuBusinessDecision {
  if (state.inputs.productCost === null) {
    return {
      type: "configure_cost",
      priority: "critical",
      message: "Falta costo de producto",
      action: "Configurar",
      impactAmount: null
    };
  }

  if (state.sync.calculationStatus === "missing_inputs") {
    return {
      type: "complete_shipping_data",
      priority: "critical",
      message: "No se puede calcular este producto",
      action: "Completar datos",
      impactAmount: null
    };
  }

  const b = state.computed.financialBreakdown;
  const ship = b?.shipping;
  const shipMiss = ship?.missing ?? [];

  // [2] FISCAL INTEGRITY
  if (b && (b.missing.includes("iibb") || b.missing.includes("tax"))) {
    return {
      type: "configure_fiscal",
      priority: "high",
      message: "Falta configuración fiscal",
      action: "Configurar impuestos",
      impactAmount: null
    };
  }

  const lo = b?.logisticsOperating;
  if (lo && lo.completeness === "partial" && (lo.mode === "flex" || lo.mode === "full")) {
    return {
      type: "complete_shipping_data",
      priority: "high",
      message: "Faltan costos logísticos",
      action: "Configurar logística",
      impactAmount: null
    };
  }

  if (state.ml.freeShipping === null) {
    return {
      type: "complete_shipping_data",
      priority: "high",
      message: "Falta dato de envío",
      action: "Definir envío gratis",
      impactAmount: null
    };
  }

  if (state.sync.calculationStatus === "error") {
    return {
      type: "complete_shipping_data",
      priority: "critical",
      message: "No se puede calcular este producto",
      action: "Completar datos",
      impactAmount: null
    };
  }

  const freeTrue = state.ml.freeShipping === true;
  const missWeight = shipMiss.includes("package_weight");
  const missPriceBand = shipMiss.includes("price");
  const missRepSync = shipMiss.includes("ml_reputation_sync");
  const shippingIncompleteForFree = freeTrue && (!ship || ship.completeness !== "complete");

  if (freeTrue && ship?.source === "missing_reputation") {
    return {
      type: "complete_shipping_data",
      priority: "high",
      message: "Falta reputación ML de cuenta",
      action: "Sincronizar cuenta",
      impactAmount: null
    };
  }

  if (freeTrue && ship?.source === "missing_table") {
    return {
      type: "fix_shipping",
      priority: "high",
      message: "Tabla envío AR no disponible para esta reputación",
      action: "Revisar envío gratis",
      impactAmount: null
    };
  }

  if (shippingIncompleteForFree || (freeTrue && (missWeight || missPriceBand || missRepSync))) {
    return {
      type: "fix_shipping",
      priority: "high",
      message: "El envío gratis está mal configurado",
      action: "Corregir envío",
      impactAmount: null
    };
  }

  const netProfit = state.computed.realProfit;

  // [4] SHIPPING STRATEGY BREAK (strictly after [3] so “complete” path still evaluated)
  if (freeTrue && netProfit !== null && netProfit < 0) {
    const sim = state.fieldSources.freeShipping === "local_simulation";
    return {
      type: "fix_shipping",
      priority: "critical",
      message: sim ? "Simulación: no rentable con envío gratis" : "No rentable con envío gratis",
      action: "Quitar envío gratis",
      impactAmount: null
    };
  }

  const netFull = state.computed.profitCompleteness === "net_full";

  // [5] PRICE FAILURE
  if (netProfit !== null && netProfit < 0) {
    return {
      type: "fix_price",
      priority: "critical",
      message: "Estás perdiendo dinero",
      action: "Subir precio",
      impactAmount: netFull ? netProfit : null
    };
  }

  const realMargin = state.computed.realMarginPct;
  const targetMargin = state.inputs.targetMarginPct;

  // [6] MARGIN OPTIMIZATION
  if (
    netProfit !== null &&
    netProfit >= 0 &&
    realMargin !== null &&
    targetMargin !== null &&
    Number.isFinite(realMargin) &&
    Number.isFinite(targetMargin) &&
    realMargin < targetMargin
  ) {
    return {
      type: "fix_price",
      priority: "medium",
      message: "Margen bajo",
      action: "Optimizar precio",
      impactAmount: null
    };
  }

  // [7] STOCK DECISION
  if (state.decision.stockStatus === "critical") {
    return {
      type: "replenish_stock",
      priority: "medium",
      message: "Stock crítico",
      action: "Reponer stock",
      impactAmount: null
    };
  }

  // [8] DEFAULT
  return {
    type: "hold",
    priority: "low",
    message: "Todo en orden",
    action: "Mantener",
    impactAmount: null
  };
}

export function buildSkuDecisionState(input: BuildSkuDecisionStateInput): SkuDecisionState {
  const accountId = input.accountId;
  const publicidadPct = input.inputs.publicidadPct ?? 0;
  const targetMarginRaw =
    input.inputs.targetMarginPct === null || input.inputs.targetMarginPct === undefined
      ? null
      : normalizePct(input.inputs.targetMarginPct);
  const targetMarginValid =
    targetMarginRaw !== null && Number.isFinite(targetMarginRaw) && targetMarginRaw > 0 ? targetMarginRaw : null;

  const safetyStockPct =
    input.inputs.safetyStockPct === null || input.inputs.safetyStockPct === undefined
      ? 0.2
      : Number.isFinite(input.inputs.safetyStockPct)
        ? input.inputs.safetyStockPct
        : 0.2;

  const productCostRaw = input.inputs.productCost;
  const productCost =
    productCostRaw === null || productCostRaw === undefined || !Number.isFinite(productCostRaw)
      ? null
      : productCostRaw;

  const additionalCosts =
    input.inputs.additionalCosts === null || input.inputs.additionalCosts === undefined
      ? null
      : !Number.isFinite(input.inputs.additionalCosts)
        ? null
        : input.inputs.additionalCosts;

  const rowInternalLogisticsCost =
    input.inputs.rowInternalLogisticsCost !== undefined &&
    input.inputs.rowInternalLogisticsCost !== null &&
    Number.isFinite(input.inputs.rowInternalLogisticsCost)
      ? Number(input.inputs.rowInternalLogisticsCost)
      : null;

  const mergedFinancial = mergeSellerFinancialSettings(
    input.financialSettings ?? null,
    input.inputs.taxPct,
    input.inputs.iibbPct
  );

  const logistica = operatorLogisticaFromMl(input);
  const rep = coerceReputacion(input.inputs.reputacion ?? null);
  const pesoKg = input.inputs.pesoKg ?? null;

  const loForOptimal = resolveLogisticsOperatingCostBreakdown({
    logistica,
    financialSettings: mergedFinancial,
    rowInternalLogisticsCost
  });
  const logisticsIncompleteForOptimal =
    loForOptimal.completeness === "partial" && (loForOptimal.mode === "flex" || loForOptimal.mode === "full");

  const acc = input.accountReputation;
  const accountReputationState = deriveSellerReputationStateFromPersistedAccount(
    acc?.sellerReputationSyncedAt ?? null,
    acc?.sellerReputationLevel ?? null,
    acc?.sellerPowerSellerStatus ?? null
  );
  const sellerRep = resolveSellerReputationForRow({
    accountLevel: acc?.sellerReputationLevel ?? null,
    accountPower: acc?.sellerPowerSellerStatus ?? null,
    accountSyncedAt: acc?.sellerReputationSyncedAt ?? null,
    legacyPricingReputacion: input.inputs.reputacion ?? null
  });
  const itemCondition = parseMlItemCondition(input.ml.condition ?? null);
  const packageKg =
    input.ml.packageWeightKg !== null &&
    input.ml.packageWeightKg !== undefined &&
    Number.isFinite(Number(input.ml.packageWeightKg))
      ? Number(input.ml.packageWeightKg)
      : null;
  const shipMode = normalizeOfficialShippingMode(input.ml.logisticType ?? null, input.ml.shippingMode ?? null);

  const shippingOmit = (): Omit<ShippingCostInput, "price"> => ({
    packageWeightKg: packageKg,
    reputation: sellerRep,
    shippingMode: shipMode,
    freeShipping: input.ml.freeShipping ?? null,
    condition: itemCondition,
    accountReputationSynced: Boolean(acc?.sellerReputationSyncedAt && String(acc.sellerReputationSyncedAt).trim() !== "")
  });

  const currentPrice = normalizeCurrentPrice(input.ml.currentPrice ?? null);
  const stock = normalizeStock(input.ml.stock ?? null);
  const ventas30d = normalizeVentas30d(input.ml.ventas30d ?? null);

  const ml = {
    accountId,
    itemId: input.ml.itemId ?? null,
    sku: input.ml.sku ?? null,
    title: (input.ml.title ?? "").trim() || "—",
    imageUrl: input.ml.imageUrl ?? null,
    currentPrice,
    stock,
    ventas30d,
    revenue30d:
      input.ml.revenue30d === null || input.ml.revenue30d === undefined || !Number.isFinite(Number(input.ml.revenue30d))
        ? null
        : Number(input.ml.revenue30d),
    lastSaleDate: input.ml.lastSaleDate ?? null,
    shippingMode: input.ml.shippingMode ?? null,
    freeShipping: input.ml.freeShipping ?? null,
    categoryId: input.ml.categoryId ?? null,
    listingType: input.ml.listingType ?? null,
    condition: input.ml.condition ?? null,
    packageWeightKg: packageKg
  };

  const inputsOut: SkuDecisionState["inputs"] = {
    productCost,
    logistics: input.inputs.logistics ?? null,
    publicidadPct,
    /** Null si el usuario no definió margen o el valor no es válido (> 0). Sin default 15%. */
    targetMarginPct: targetMarginValid,
    safetyStockPct,
    taxPct: mergedFinancial.taxPct,
    iibbPct: mergedFinancial.iibbPct,
    additionalCosts
  };

  let calculationStatus: SkuDecisionState["sync"]["calculationStatus"] = "valid";
  if (productCost === null) {
    calculationStatus = "missing_inputs";
  }

  let optimalPrice: number | null = null;
  let sellResult: ReturnType<typeof calcSellingPrice> | null = null;
  if (
    productCost !== null &&
    productCost > 0 &&
    targetMarginValid !== null &&
    !logisticsIncompleteForOptimal
  ) {
    sellResult = calcSellingPrice({
      costo: productCost,
      logistica,
      publicidad_pct: publicidadPct,
      margen_pct: targetMarginValid,
      reputacion: rep,
      financialSettings: mergedFinancial,
      skuAdditionalFixedCost: additionalCosts,
      rowInternalLogisticsCost,
      sellerShippingAtPrice: (p) => {
        const fsShip = input.ml.freeShipping ?? null;
        if (fsShip === false) return 0;
        if (fsShip === null) return Number.NaN;
        const e = estimateSellerShippingCostAr({ ...shippingOmit(), price: p });
        return e.completeness === "complete" && e.sellerShippingCost !== null ? e.sellerShippingCost : Number.NaN;
      }
    });
    if (sellResult.converged && Number.isFinite(sellResult.precio_venta) && sellResult.precio_venta > 0) {
      optimalPrice = Math.round(sellResult.precio_venta * 100) / 100;
    } else if (calculationStatus === "valid") {
      calculationStatus = "error";
    }
  } else if (productCost !== null && productCost > 0 && targetMarginValid !== null && logisticsIncompleteForOptimal) {
    if (calculationStatus === "valid") calculationStatus = "partial";
  }

  let realProfit: number | null = null;
  let realMarginPct: number | null = null;
  let realComisionAmount: number | null = null;
  let realShippingAmount: number | null = null;
  let realAdsAmount: number | null = null;
  let realProductCostApplied: number | null = null;
  let financialBreakdown: FinancialCostBreakdown | null = null;
  let profitCompleteness: SkuDecisionState["computed"]["profitCompleteness"] = null;

  if (productCost === null) {
    realProfit = null;
    realMarginPct = null;
    if (currentPrice !== null && Number.isFinite(currentPrice) && currentPrice > 0) {
      financialBreakdown = calculateFinancialCostBreakdown({
        salePrice: currentPrice,
        productCost: null,
        logistica,
        reputacion: rep,
        publicidad_pct: input.inputs.publicidadPct ?? null,
        financialSettings: mergedFinancial,
        skuAdditionalFixedCost: additionalCosts,
        shipping: shippingOmit(),
        rowInternalLogisticsCost
      });
    }
  } else if (currentPrice === null || !Number.isFinite(productCost) || productCost < 0) {
    realProfit = null;
    realMarginPct = null;
    if (productCost !== null) calculationStatus = "missing_inputs";
  } else {
    const rp = calcRealProfit({
      price_ml: currentPrice,
      productCost,
      logistica,
      reputacion: rep,
      publicidad_pct: input.inputs.publicidadPct ?? null,
      peso_kg: pesoKg,
      financialSettings: mergedFinancial,
      skuAdditionalFixedCost: additionalCosts,
      shipping: shippingOmit(),
      rowInternalLogisticsCost
    });
    financialBreakdown = rp.breakdown;
    profitCompleteness = netProfitCompleteFromBreakdown(rp.breakdown, input.ml.freeShipping ?? null)
      ? "net_full"
      : "net_partial";
    if (
      calculationStatus === "valid" &&
      (rp.breakdown.missing.includes("iibb") ||
        rp.breakdown.missing.includes("tax") ||
        rp.breakdown.missing.some((x) => x.startsWith("shipping_")) ||
        rp.breakdown.missing.some((x) => x.startsWith("logistics_")))
    ) {
      calculationStatus = "partial";
    }
    if (rp.converged && Number.isFinite(rp.ganancia_real) && Number.isFinite(rp.margen_real)) {
      realProfit = rp.breakdown.netProfit;
      realMarginPct = rp.breakdown.netMarginPct;
      realComisionAmount = Number.isFinite(rp.comision_$) ? rp.comision_$ : null;
      realShippingAmount = Number.isFinite(rp.envio_$) ? rp.envio_$ : null;
      realAdsAmount = Number.isFinite(rp.publicidad_$) ? rp.publicidad_$ : null;
      realProductCostApplied = rp.breakdown.productCost;
    } else {
      realProfit = null;
      realMarginPct = null;
      profitCompleteness = null;
      if (calculationStatus !== "missing_inputs") {
        calculationStatus = "error";
      }
    }
  }

  const optimalGananciaUnit =
    sellResult && sellResult.converged && Number.isFinite(sellResult.ganancia_unit) ? sellResult.ganancia_unit : null;
  const optimalRoi = sellResult && sellResult.converged && Number.isFinite(sellResult.roi) ? sellResult.roi : null;

  const breakEvenPrice =
    productCost !== null && productCost > 0
      ? solveBreakEvenPrice(
          productCost,
          additionalCosts,
          mergedFinancial,
          logistica,
          rep,
          publicidadPct,
          shippingOmit,
          rowInternalLogisticsCost
        )
      : null;

  const priceDelta =
    optimalPrice !== null && currentPrice !== null && currentPrice > 0
      ? Math.round(((optimalPrice - currentPrice) / currentPrice) * 10_000) / 10_000
      : null;

  const stockBranch = computeStockBranch({ ventas30d, stock, safetyStockPct });
  const { velocity30d, idealStock, stockGap, daysOfStock, stockStatus } = stockBranch;

  const fiscalComplete = netProfitCompleteFromBreakdown(financialBreakdown, input.ml.freeShipping ?? null);
  const profitabilityStatus = profitabilityFromReal(
    realProfit,
    realMarginPct,
    targetMarginValid,
    fiscalComplete
  );

  const pricingStatus = pricingStatusFrom(
    targetMarginValid,
    optimalPrice,
    currentPrice,
    breakEvenPrice,
    Boolean(sellResult?.converged)
  );

  const { insight, action } = pickPrimaryInsight({
    profitabilityStatus,
    pricingStatus,
    stockStatus,
    publicidadPct,
    realProfit,
    breakEvenPrice,
    currentPrice,
    optimalPrice,
    targetMarginPct: targetMarginValid,
    stockGap,
    fiscalNetComplete: fiscalComplete,
    breakdownMissing: financialBreakdown?.missing ?? [],
    realMarginPct
  });

  const shipSig = pickShippingShortSignal(
    input.ml.freeShipping ?? null,
    financialBreakdown,
    shipMode,
    accountReputationState
  );

  const priorityScore = priorityScoreFrom({
    profitabilityStatus,
    pricingStatus,
    stockStatus,
    publicidadPct,
    realProfit
  });

  const freeShipSrc: FieldSource =
    input.freeShippingSource ??
    (input.ml.freeShipping === true || input.ml.freeShipping === false ? "ml_api" : "missing");

  const hasShipMode = input.ml.shippingMode !== null && String(input.ml.shippingMode ?? "").trim() !== "";
  const hasLog = input.ml.logisticType !== null && String(input.ml.logisticType ?? "").trim() !== "";
  const fieldSources = buildSkuFieldSources({
    freeShipping: freeShipSrc,
    shippingModeFromMl: { hasMode: hasShipMode, hasLogistic: hasLog },
    packageWeightKg: packageKg,
    accountReputation: acc
      ? { sellerReputationSyncedAt: acc.sellerReputationSyncedAt, sellerReputationLevel: acc.sellerReputationLevel }
      : null,
    logisticsBreakdown: loForOptimal,
    rowInternalLogisticsSet: rowInternalLogisticsCost !== null
  });

  const base: SkuDecisionStateBase = {
    ml,
    inputs: inputsOut,
    computed: {
      optimalPrice,
      optimalGananciaUnit,
      optimalRoi,
      realProfit,
      realMarginPct,
      realComisionAmount,
      realShippingAmount,
      realAdsAmount,
      realProductCostApplied,
      financialBreakdown,
      cashInAmount: financialBreakdown?.cashInAmount ?? null,
      profitCompleteness,
      breakEvenPrice,
      priceDelta,
      idealStock,
      stockGap,
      velocity30d,
      daysOfStock
    },
    decision: {
      profitabilityStatus,
      stockStatus,
      pricingStatus,
      priorityScore,
      primaryInsight: insight,
      recommendedAction: action,
      shippingMessage: shipSig.msg,
      shippingAction: shipSig.action
    },
    sync: { calculationStatus },
    fieldSources
  };

  return {
    ...base,
    businessDecision: deriveSkuBusinessDecision(base)
  };
}
