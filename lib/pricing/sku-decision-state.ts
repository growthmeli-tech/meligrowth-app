import {
  calcRealProfit,
  calcSellingPrice,
  coerceReputacion,
  normalizePct,
  type FinancialCostBreakdown,
  type LogisticaType,
  type SellerFinancialSettings
} from "@/lib/pricing/calculator";
import {
  estimateSellerShippingCostAr,
  mapMlLogisticTypeToShippingMode,
  parseMlItemCondition,
  resolveSellerReputationForRow,
  type ShippingCostInput
} from "@/lib/pricing/shipping-costs-argentina";

export type SkuDecisionState = {
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
};

export type BuildSkuDecisionStateInput = {
  accountId: string;
  /** Config financiera de cuenta (sin persistencia obligatoria). */
  financialSettings?: SellerFinancialSettings | null;
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
  };
};

function resolveLogistics(raw: string | null | undefined): LogisticaType {
  if (raw === "Full" || raw === "Flex" || raw === "Retiro domicilio") return raw;
  return "Flex";
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
    additionalCostsFixed: base?.additionalCostsFixed ?? null
  };
}

function netProfitCompleteFromBreakdown(b: FinancialCostBreakdown | null, freeShipping: boolean | null): boolean {
  if (!b) return false;
  const fiscalOk = !b.missing.includes("iibb") && !b.missing.includes("tax");
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
  shippingOmit: () => Omit<ShippingCostInput, "price">
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
      shipping: shippingOmit()
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
  shippingModeRaw: string | null
): { msg: string | null; action: string | null } {
  if (!breakdown) return { msg: null, action: null };
  const mode = mapMlLogisticTypeToShippingMode(shippingModeRaw);
  if (freeShipping === false) return { msg: null, action: null };
  if (mode === "retire" && freeShipping === true) {
    return { msg: "No soporta envío gratis", action: "Quitar envío gratis o subir precio" };
  }
  if (breakdown.shipping.source === "missing_table") {
    return { msg: "Tabla de envío no disponible", action: "Cargar tabla para esta reputación" };
  }
  if (breakdown.missing.some((m) => m === "shipping_package_weight" || m.includes("package_weight"))) {
    return { msg: "Falta peso del paquete", action: "Completar peso para estimar envío" };
  }
  if (breakdown.missing.some((m) => m === "shipping_ml_reputation" || m.includes("ml_reputation"))) {
    return { msg: "Falta reputación ML", action: "Sincronizar reputación de cuenta" };
  }
  return { msg: null, action: null };
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

  const mergedFinancial = mergeSellerFinancialSettings(
    input.financialSettings ?? null,
    input.inputs.taxPct,
    input.inputs.iibbPct
  );

  const logistica = resolveLogistics(input.inputs.logistics ?? null);
  const rep = coerceReputacion(input.inputs.reputacion ?? null);
  const pesoKg = input.inputs.pesoKg ?? null;

  const acc = input.accountReputation;
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
      : pesoKg;
  const shipMode = mapMlLogisticTypeToShippingMode(input.ml.shippingMode ?? null);

  const shippingOmit = (): Omit<ShippingCostInput, "price"> => ({
    packageWeightKg: packageKg,
    reputation: sellerRep,
    shippingMode: shipMode,
    freeShipping: input.ml.freeShipping ?? null,
    condition: itemCondition
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
  if (productCost !== null && productCost > 0 && targetMarginValid !== null) {
    sellResult = calcSellingPrice({
      costo: productCost,
      logistica,
      publicidad_pct: publicidadPct,
      margen_pct: targetMarginValid,
      reputacion: rep,
      financialSettings: mergedFinancial,
      skuAdditionalFixedCost: additionalCosts,
      sellerShippingAtPrice: (p) => {
        const e = estimateSellerShippingCostAr({ ...shippingOmit(), price: p });
        return e.completeness === "complete" && e.sellerShippingCost !== null ? e.sellerShippingCost : 0;
      }
    });
    if (sellResult.converged && Number.isFinite(sellResult.precio_venta) && sellResult.precio_venta > 0) {
      optimalPrice = Math.round(sellResult.precio_venta * 100) / 100;
    } else if (calculationStatus === "valid") {
      calculationStatus = "error";
    }
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
      shipping: shippingOmit()
    });
    financialBreakdown = rp.breakdown;
    profitCompleteness = netProfitCompleteFromBreakdown(rp.breakdown, input.ml.freeShipping ?? null)
      ? "net_full"
      : "net_partial";
    if (
      calculationStatus === "valid" &&
      (rp.breakdown.missing.includes("iibb") ||
        rp.breakdown.missing.includes("tax") ||
        rp.breakdown.missing.some((x) => x.startsWith("shipping_")))
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
          shippingOmit
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

  const shipSig = pickShippingShortSignal(input.ml.freeShipping ?? null, financialBreakdown, input.ml.shippingMode ?? null);

  const priorityScore = priorityScoreFrom({
    profitabilityStatus,
    pricingStatus,
    stockStatus,
    publicidadPct,
    realProfit
  });

  return {
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
    sync: { calculationStatus }
  };
}
