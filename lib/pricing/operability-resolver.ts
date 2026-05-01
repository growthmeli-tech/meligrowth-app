import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";

export type SellerShippingCostStatus =
  | { kind: "not_applicable"; reason: "buyer_pays_shipping" }
  | { kind: "applies"; amount: number }
  | { kind: "missing_weight" }
  | { kind: "missing_reputation" }
  | { kind: "missing_table" }
  | { kind: "unknown" };

export type ProfitKind = "real" | "estimated" | "unavailable";

export type RowOperability = {
  status: "operable" | "partial" | "blocked";
  reason: string | null;
};

export type MlPricePushReadiness = {
  safeToPushMlPrice: boolean;
  blockedReason: string | null;
};

type DecisionLike = Pick<SkuDecisionState, "ml" | "computed" | "inputs">;

function hasFinite(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

export function resolveProfitKind(computed: DecisionLike["computed"]): ProfitKind {
  if (computed.cashInCompleteness === "invalid" || computed.financialCompleteness === "invalid") {
    return "unavailable";
  }
  if (!hasFinite(computed.realProfit)) return "unavailable";
  return computed.cashInCompleteness === "complete" ? "real" : "estimated";
}

export function resolveSellerShippingCostStatus(decision: DecisionLike): SellerShippingCostStatus {
  const freeShipping = decision.ml.freeShipping;
  const shipping = decision.computed.financialBreakdown?.shipping;
  const missing = shipping?.missing ?? [];

  if (freeShipping === false) {
    return { kind: "not_applicable", reason: "buyer_pays_shipping" };
  }
  if (freeShipping === null) {
    return { kind: "unknown" };
  }
  if (shipping?.completeness === "complete" && hasFinite(shipping.sellerShippingCost)) {
    return { kind: "applies", amount: shipping.sellerShippingCost };
  }
  if (missing.includes("package_weight")) {
    return { kind: "missing_weight" };
  }
  if (shipping?.source === "missing_reputation" || missing.includes("ml_reputation_sync")) {
    return { kind: "missing_reputation" };
  }
  if (shipping?.source === "missing_table" || missing.includes("shipping_table_for_reputation")) {
    return { kind: "missing_table" };
  }
  return { kind: "unknown" };
}

export function resolveRowOperability(decision: DecisionLike): RowOperability {
  const productCost = (decision as { inputs?: { productCost?: number | null } }).inputs?.productCost ?? null;
  if (!hasFinite(decision.ml.currentPrice) || decision.ml.currentPrice <= 0) {
    return { status: "blocked", reason: "Falta precio ML" };
  }
  if (!hasFinite(productCost) || productCost < 0) {
    return { status: "blocked", reason: "Falta costo" };
  }

  const ship = resolveSellerShippingCostStatus(decision);
  if (decision.ml.freeShipping === null) {
    return { status: "partial", reason: "Falta envio ML" };
  }
  if (decision.ml.freeShipping === true && ship.kind !== "applies") {
    if (ship.kind === "missing_weight") return { status: "partial", reason: "Falta peso para envio ML" };
    if (ship.kind === "missing_reputation") return { status: "partial", reason: "Falta reputacion ML" };
    if (ship.kind === "missing_table") return { status: "partial", reason: "Falta tabla de envio ML" };
    return { status: "partial", reason: "Falta envio ML" };
  }

  const missing = decision.computed.financialBreakdown?.missing ?? [];
  if (missing.includes("iibb")) return { status: "partial", reason: "Falta IIBB" };
  if (missing.includes("tax")) return { status: "partial", reason: "Falta impuestos" };

  return { status: "operable", reason: null };
}

export function resolveMlPricePushReadiness(input: {
  itemId: string | null | undefined;
  currentPrice: number | null;
  recommendedPrice: number | null;
  decision: DecisionLike;
}): MlPricePushReadiness {
  const productCost = (input.decision as { inputs?: { productCost?: number | null } }).inputs?.productCost ?? null;
  const operability = resolveRowOperability(input.decision);
  const profitKind = resolveProfitKind(input.decision.computed);

  if (!input.itemId) return { safeToPushMlPrice: false, blockedReason: "Falta item ML" };
  if (!hasFinite(input.currentPrice) || input.currentPrice <= 0) {
    return { safeToPushMlPrice: false, blockedReason: "Falta precio ML" };
  }
  if (!hasFinite(productCost) || productCost < 0) {
    return { safeToPushMlPrice: false, blockedReason: "Falta costo" };
  }
  if (!hasFinite(input.recommendedPrice) || input.recommendedPrice <= 0) {
    return { safeToPushMlPrice: false, blockedReason: "Sin precio recomendado" };
  }
  if (operability.status !== "operable") {
    return { safeToPushMlPrice: false, blockedReason: operability.reason ?? "Calculo parcial" };
  }
  if (profitKind !== "real") {
    return { safeToPushMlPrice: false, blockedReason: "Calculo parcial" };
  }
  return { safeToPushMlPrice: true, blockedReason: null };
}

export type PricingAutomationCandidate = {
  itemId: string;
  currentPrice: number | null;
  recommendedPrice: number | null;
  productCost: number | null;
  cashInAmount: number | null;
  profitAmount: number | null;
  profitKind: ProfitKind;
  targetMarginPct: number | null;
  freeShipping: boolean | null;
  sellerShippingCostStatus: SellerShippingCostStatus["kind"];
  operabilityStatus: "operable" | "partial" | "blocked";
  safeToPush: boolean;
  blockedReason: string | null;
};

export function buildPricingAutomationCandidate(input: {
  itemId: string;
  currentPrice: number | null;
  recommendedPrice: number | null;
  decision: DecisionLike;
}): PricingAutomationCandidate {
  const shippingStatus = resolveSellerShippingCostStatus(input.decision);
  const operability = resolveRowOperability(input.decision);
  const readiness = resolveMlPricePushReadiness(input);
  return {
    itemId: input.itemId,
    currentPrice: input.currentPrice,
    recommendedPrice: input.recommendedPrice,
    productCost: input.decision.inputs.productCost,
    cashInAmount: input.decision.computed.cashInAmount,
    profitAmount: input.decision.computed.realProfit,
    profitKind: resolveProfitKind(input.decision.computed),
    targetMarginPct: input.decision.inputs.targetMarginPct,
    freeShipping: input.decision.ml.freeShipping,
    sellerShippingCostStatus: shippingStatus.kind,
    operabilityStatus: operability.status,
    safeToPush: readiness.safeToPushMlPrice,
    blockedReason: readiness.blockedReason
  };
}
