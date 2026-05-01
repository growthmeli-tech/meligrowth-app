/**
 * Pure ML shipping normalizer — Mercado Libre API `shipping` object only.
 * No inference of freeShipping from mode; no Flex/Full without ML evidence.
 *
 * Values align with `ShippingMode` in `lib/pricing/shipping-costs-argentina.ts` (no import to avoid cycles).
 */

/** Same string union as `ShippingMode` in pricing — keep in sync manually. */
import { publicMlLogisticsPublicationLabel } from "@/lib/pricing/ml-public-logistics-label";

export type NormalizedMlShippingMode = "full" | "flex" | "me2" | "retire" | "custom" | "unknown";

/** Etiqueta solo para UI operador; el modo interno sigue en `shippingMode`. */
export type MlShippingNormalizationLabel = string;

export type MlShippingNormalizeConfidence = "high" | "medium" | "low";

export type NormalizeMlShippingInput = {
  /** ML `shipping.mode` */
  mode?: string | null;
  /** ML `shipping.logistic_type` */
  logistic_type?: string | null;
  /** ML `shipping.free_shipping` when key present */
  free_shipping?: boolean | null;
  /** True iff parent `shipping` had own property `free_shipping` */
  free_shipping_key_present?: boolean;
  tags?: unknown;
  methods?: unknown;
  local_pick_up?: boolean | null;
  store_pick_up?: boolean | null;
};

export type NormalizeMlShippingResult = {
  shippingMode: NormalizedMlShippingMode;
  freeShipping: boolean | null;
  rawMode: string | null;
  rawLogisticType: string | null;
  tags: unknown[];
  methods: unknown[];
  label: MlShippingNormalizationLabel;
  confidence: MlShippingNormalizeConfidence;
  reasons: string[];
};

function normStr(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function asStringArray(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === "string" && t.trim()) out.push(t.trim().toLowerCase());
  }
  return out;
}

function asMethodArray(methods: unknown): unknown[] {
  return Array.isArray(methods) ? [...methods] : [];
}

/** Flex evidence — tags/methods that explicitly reference self_service / meli flex. */
export function hasVerifiedFlexSignal(tags: string[], methods: unknown[]): boolean {
  for (const t of tags) {
    if (t.includes("self_service") || t.includes("meli_flex") || t === "flex") return true;
  }
  for (const m of methods) {
    if (m && typeof m === "object") {
      const o = m as Record<string, unknown>;
      for (const k of ["logistic_type", "mode", "id", "name", "type"]) {
        const v = o[k];
        if (typeof v === "string" && v.toLowerCase().includes("self_service")) return true;
      }
    } else if (typeof m === "string" && m.toLowerCase().includes("self_service")) return true;
  }
  return false;
}

function isFulfillmentLt(lt: string): boolean {
  const t = lt.toLowerCase();
  return t.includes("fulfillment") || t === "full";
}

function isSelfServiceLt(lt: string): boolean {
  return lt.toLowerCase().includes("self_service");
}

function isMe2FamilyLt(lt: string): boolean {
  const t = lt.toLowerCase();
  if (t === "default") return true;
  if (t.includes("drop_off")) return true;
  if (t.startsWith("xd_")) return true;
  if (t.includes("cross_docking")) return true;
  if (t === "me2" || t.includes("me2")) return true;
  return false;
}

function isRetireLt(lt: string): boolean {
  const t = lt.toLowerCase();
  return t.includes("retir") || t.includes("pick_up") || t.includes("store_pick_up");
}

function isCustomLt(lt: string): boolean {
  return lt.toLowerCase().includes("custom");
}

function buildLabelStrict(mode: NormalizedMlShippingMode, free: boolean | null): string {
  return publicMlLogisticsPublicationLabel(mode, free);
}

function classifyModeStringOnly(mode: string): {
  mode: NormalizedMlShippingMode;
  confidence: MlShippingNormalizeConfidence;
  reasons: string[];
} {
  const t = mode.toLowerCase();
  if (t.includes("fulfillment") || t === "full") return { mode: "full", confidence: "medium", reasons: ["fallback_mode_fulfillment"] };
  if (t.includes("self_service")) return { mode: "flex", confidence: "medium", reasons: ["fallback_mode_self_service"] };
  if (t.includes("custom")) return { mode: "custom", confidence: "medium", reasons: ["fallback_mode_custom"] };
  if (t.includes("me2") || t === "default" || t.includes("not_specified")) {
    return { mode: "me2", confidence: "medium", reasons: ["fallback_mode_me2_family", "no_flex_specific_signal"] };
  }
  return { mode: "unknown", confidence: "low", reasons: ["mode_unmapped"] };
}

/**
 * Single source for ML publication logistics mode + label.
 */
export function normalizeMlShipping(raw: NormalizeMlShippingInput): NormalizeMlShippingResult {
  const rawMode = normStr(raw.mode ?? null);
  const rawLt = normStr(raw.logistic_type ?? null);
  const tags = asStringArray(raw.tags);
  const methods = asMethodArray(raw.methods);
  const flexOk = hasVerifiedFlexSignal(tags, methods);

  let freeShipping: boolean | null = null;
  if (raw.free_shipping_key_present === false) {
    freeShipping = null;
  } else if (raw.free_shipping === true) {
    freeShipping = true;
  } else if (raw.free_shipping === false) {
    freeShipping = false;
  } else if (raw.free_shipping === null && raw.free_shipping_key_present === true) {
    freeShipping = null;
  } else {
    freeShipping = null;
  }

  const reasons: string[] = [];
  let shippingMode: NormalizedMlShippingMode = "unknown";
  let confidence: MlShippingNormalizeConfidence = "low";

  const lt = rawLt ?? "";
  const modeLower = (rawMode ?? "").toLowerCase();

  if (rawLt && isFulfillmentLt(rawLt)) {
    shippingMode = "full";
    confidence = "high";
    reasons.push("logistic_type_fulfillment");
  } else if (rawLt && isSelfServiceLt(rawLt)) {
    shippingMode = "flex";
    confidence = "high";
    reasons.push("logistic_type_self_service");
  } else if (rawLt && isRetireLt(rawLt)) {
    shippingMode = "retire";
    confidence = "high";
    reasons.push("logistic_type_pickup");
  } else if (rawLt && isCustomLt(rawLt)) {
    shippingMode = "custom";
    confidence = "high";
    reasons.push("logistic_type_custom");
  } else if (modeLower.includes("custom")) {
    shippingMode = "custom";
    confidence = "medium";
    reasons.push("shipping_mode_custom");
  } else if (rawLt && isMe2FamilyLt(rawLt)) {
    shippingMode = "me2";
    confidence = "medium";
    if (!flexOk) reasons.push("no_flex_specific_signal");
    reasons.push("logistic_type_me2_family");
  } else if (!rawLt && flexOk) {
    shippingMode = "flex";
    confidence = "medium";
    reasons.push("verified_flex_signal_only");
  } else if (
    (raw.local_pick_up === true || raw.store_pick_up === true) &&
    (modeLower.includes("not_specified") || !rawLt)
  ) {
    shippingMode = "retire";
    confidence = "medium";
    reasons.push("pickup_flags");
  } else if (rawMode) {
    const fromMode = classifyModeStringOnly(rawMode);
    shippingMode = fromMode.mode;
    confidence = fromMode.confidence;
    reasons.push(...fromMode.reasons);
  } else if (rawLt) {
    shippingMode = "unknown";
    confidence = "low";
    reasons.push("logistic_type_unmapped");
  } else {
    shippingMode = "unknown";
    confidence = "low";
    reasons.push("insufficient_signal");
  }

  const label = buildLabelStrict(shippingMode, freeShipping);
  return {
    shippingMode,
    freeShipping,
    rawMode,
    rawLogisticType: rawLt,
    tags,
    methods,
    label,
    confidence,
    reasons
  };
}
