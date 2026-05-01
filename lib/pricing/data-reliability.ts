/**
 * Data trust / completeness / operability — deterministic, no silent inference of ML truth.
 * Catalog + decision surfaces consume `CatalogDataTrust` built server-side (or pure shared layer).
 */

export type DataCompleteness = {
  hasPrice: boolean;
  hasCost: boolean;
  hasStock: boolean;
  /** ML `shipping.free_shipping` known as boolean (true/false), not null / absent. */
  hasFreeShipping: boolean;
  /** ML package weight from dimensions / synced kg on publication. */
  hasWeight: boolean;
};

export type OperabilityStatus = "operable" | "partial" | "blocked";

export type DecisionConfidence = {
  level: "high" | "medium" | "low";
  reasons: string[];
};

export type CatalogDataTrust = {
  dataCompleteness: DataCompleteness;
  operabilityStatus: OperabilityStatus;
  decisionConfidence: DecisionConfidence;
  /** ML payload included `shipping.free_shipping` key; false flags integration gaps. */
  mlFreeShippingKeyPresent: boolean | null;
  /** Heuristic from tags/methods only — never overrides ML API fields. */
  flexDetected: boolean;
  flexDetectionReasons: string[];
};

function hasFiniteNonNegativePrice(price: number | null | undefined): boolean {
  return price !== null && price !== undefined && Number.isFinite(Number(price)) && Number(price) >= 0;
}

function hasFiniteNonNegativeCost(cost: number | null | undefined): boolean {
  return cost !== null && cost !== undefined && Number.isFinite(Number(cost)) && Number(cost) >= 0;
}

function hasFiniteNonNegativeStock(stock: number | null | undefined): boolean {
  return stock !== null && stock !== undefined && Number.isFinite(Number(stock)) && Number(stock) >= 0;
}

function hasPositiveMlWeightKg(kg: number | null | undefined): boolean {
  if (kg === null || kg === undefined) return false;
  const n = Number(kg);
  return Number.isFinite(n) && n > 0;
}

/**
 * DB-backed rows always include `free_shipping`; use persisted `free_shipping_key_present` when synced.
 * For in-memory tests, `typeof free_shipping === "boolean"` implies an ML-shaped payload.
 */
export function resolveMlFreeShippingKeyPresentForRow(
  persisted: boolean | null | undefined,
  mlFreeShippingValue: boolean | null | undefined
): boolean | null {
  if (persisted === true || persisted === false) return persisted;
  if (typeof mlFreeShippingValue === "boolean") return true;
  return null;
}

export function buildDataCompleteness(input: {
  priceMl: number | null;
  productCost: number | null;
  stock: number | null;
  mlFreeShippingBoolean: boolean | null;
  mlFreeShippingKeyPresent: boolean | null;
  mlPackageWeightKg: number | null;
}): DataCompleteness {
  const keyOk = input.mlFreeShippingKeyPresent === true;
  const boolKnown =
    keyOk && (input.mlFreeShippingBoolean === true || input.mlFreeShippingBoolean === false);
  return {
    hasPrice: hasFiniteNonNegativePrice(input.priceMl),
    hasCost: hasFiniteNonNegativeCost(input.productCost),
    hasStock: hasFiniteNonNegativeStock(input.stock),
    hasFreeShipping: boolKnown,
    hasWeight: hasPositiveMlWeightKg(input.mlPackageWeightKg)
  };
}

/**
 * Flex (ML): never use `logistic_type` alone. Requires `self_service` tag or explicit method signal.
 */
export function detectFlexFromMlShipping(input: { tags: string[]; methods: unknown[] }): {
  detected: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const t of input.tags) {
    const tl = String(t).toLowerCase();
    if (tl.includes("self_service")) {
      reasons.push("ml_shipping_tag:self_service");
      return { detected: true, reasons };
    }
  }
  const methodSignals = ["same_day", "same-day", "local_pickup", "pick_up_in_store", "xd_drop_off_near"];
  for (const m of input.methods) {
    if (typeof m === "string") {
      const s = m.toLowerCase();
      if (methodSignals.some((k) => s.includes(k))) {
        reasons.push(`ml_shipping_method_string:${s}`);
        return { detected: true, reasons };
      }
      continue;
    }
    if (m && typeof m === "object") {
      const o = m as { id?: unknown; name?: unknown; mode?: unknown };
      const id = typeof o.id === "string" ? o.id.toLowerCase() : "";
      const name = typeof o.name === "string" ? o.name.toLowerCase() : "";
      const mode = typeof o.mode === "string" ? o.mode.toLowerCase() : "";
      const blob = `${id} ${name} ${mode}`;
      if (blob.includes("self_service")) {
        reasons.push("ml_shipping_method:self_service");
        return { detected: true, reasons };
      }
      if (methodSignals.some((k) => blob.includes(k))) {
        reasons.push(`ml_shipping_method:${id || name || mode}`);
        return { detected: true, reasons };
      }
    }
  }
  return { detected: false, reasons: [] };
}

export function coerceShippingTagsFromJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

export function coerceShippingMethodsFromJson(raw: unknown): unknown[] {
  return Array.isArray(raw) ? [...raw] : [];
}

export function computeOperabilityStatus(
  completeness: DataCompleteness,
  effectiveFreeShipping: boolean | null
): OperabilityStatus {
  if (!completeness.hasCost || !completeness.hasPrice) return "blocked";
  if (effectiveFreeShipping === null) return "partial";
  if (effectiveFreeShipping === true && !completeness.hasWeight) return "partial";
  return "operable";
}

export function computeDecisionConfidence(input: {
  completeness: DataCompleteness;
  operability: OperabilityStatus;
  mlFreeShippingKeyPresent: boolean | null;
  effectiveFreeShipping: boolean | null;
}): DecisionConfidence {
  const reasons: string[] = [];

  if (input.mlFreeShippingKeyPresent === false) {
    reasons.push("ml_contract:shipping.free_shipping key absent from ML item payload");
  }
  if (!input.completeness.hasCost) reasons.push("missing:cost_pricing_sku");
  if (!input.completeness.hasPrice) reasons.push("missing:price_ml");
  if (!input.completeness.hasStock) reasons.push("missing:stock_ml");
  if (!input.completeness.hasFreeShipping) reasons.push("missing:ml_free_shipping_boolean");
  if (!input.completeness.hasWeight) reasons.push("missing:ml_package_weight");

  if (input.operability === "blocked") {
    return { level: "low", reasons };
  }
  if (input.mlFreeShippingKeyPresent === false || !input.completeness.hasFreeShipping) {
    return { level: "low", reasons: [...reasons] };
  }
  if (input.effectiveFreeShipping === null) {
    return { level: "low", reasons: [...reasons, "resolved_free_shipping_null"] };
  }

  const allComplete =
    input.completeness.hasPrice &&
    input.completeness.hasCost &&
    input.completeness.hasStock &&
    input.completeness.hasFreeShipping &&
    input.completeness.hasWeight;

  if (input.operability === "operable" && allComplete) {
    return { level: "high", reasons: ["all_required_inputs_present"] };
  }
  if (input.operability === "partial") {
    return { level: "medium", reasons: reasons.length ? reasons : ["partial_operability"] };
  }
  return { level: "medium", reasons: reasons.length ? reasons : ["operability_not_full"] };
}

export function buildCatalogDataTrust(input: {
  priceMl: number | null;
  productCost: number | null;
  stock: number | null;
  mlFreeShippingBoolean: boolean | null;
  mlFreeShippingKeyPresent: boolean | null;
  mlPackageWeightKg: number | null;
  effectiveFreeShipping: boolean | null;
  shippingTags: string[];
  shippingMethods: unknown[];
}): CatalogDataTrust {
  const completeness = buildDataCompleteness({
    priceMl: input.priceMl,
    productCost: input.productCost,
    stock: input.stock,
    mlFreeShippingBoolean: input.mlFreeShippingBoolean,
    mlFreeShippingKeyPresent: input.mlFreeShippingKeyPresent,
    mlPackageWeightKg: input.mlPackageWeightKg
  });
  const operabilityStatus = computeOperabilityStatus(completeness, input.effectiveFreeShipping);
  const flex = detectFlexFromMlShipping({ tags: input.shippingTags, methods: input.shippingMethods });
  const decisionConfidence = computeDecisionConfidence({
    completeness,
    operability: operabilityStatus,
    mlFreeShippingKeyPresent: input.mlFreeShippingKeyPresent,
    effectiveFreeShipping: input.effectiveFreeShipping
  });

  return {
    dataCompleteness: completeness,
    operabilityStatus,
    decisionConfidence,
    mlFreeShippingKeyPresent: input.mlFreeShippingKeyPresent,
    flexDetected: flex.detected,
    flexDetectionReasons: flex.reasons
  };
}

export type FreeShippingContractAudit = {
  total: number;
  freeShippingKeyMissing: number;
  freeShippingExplicitNull: number;
};

export function auditFreeShippingContractFromParsedCatalog(items: { free_shipping: boolean | null; free_shipping_key_present: boolean }[]): FreeShippingContractAudit {
  let freeShippingKeyMissing = 0;
  let freeShippingExplicitNull = 0;
  for (const it of items) {
    if (it.free_shipping_key_present === false) freeShippingKeyMissing += 1;
    else if (it.free_shipping_key_present === true && it.free_shipping === null) freeShippingExplicitNull += 1;
  }
  return { total: items.length, freeShippingKeyMissing, freeShippingExplicitNull };
}
