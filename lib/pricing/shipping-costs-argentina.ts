/** Pure ML Argentina shipping cost domain — client-safe types & table estimates (no I/O). */

import {
  deriveSellerReputationStateFromPersistedAccount,
  type SellerReputationState
} from "@/lib/pricing/seller-reputation-state";

export type SellerReputation =
  | "mercado_lider_green"
  | "green"
  | "no_reputation"
  | "yellow"
  | "orange"
  | "red"
  | "unknown";

export type ShippingReputationGroup =
  | "leader_green_or_none"
  | "yellow"
  | "orange_or_red"
  | "unknown";

export type ShippingMode = "full" | "flex" | "me2" | "custom" | "retire" | "unknown";

export type PriceBand = "under_33000" | "from_33000_to_49999" | "from_50000";

export type WeightBand =
  | "up_to_0_3"
  | "from_0_3_to_0_5"
  | "from_0_5_to_1"
  | "from_1_to_1_5"
  | "from_1_5_to_2"
  | "from_2_to_3"
  | "from_3_to_4"
  | "from_4_to_5"
  | "from_5_to_8"
  | "from_8_to_10"
  | "from_10_to_13"
  | "from_13_to_15"
  | "from_15_to_20"
  | "from_20_to_25"
  | "from_25_to_30"
  | "from_30_to_40"
  | "from_40_to_50"
  | "from_50_to_60"
  | "from_60_to_70"
  | "from_70_to_80"
  | "from_80_to_90"
  | "from_90_to_100"
  | "from_100_to_120"
  | "from_120_to_140"
  | "from_140_to_160"
  | "from_160_to_180"
  | "over_180";

export type ShippingCostInput = {
  price: number | null;
  packageWeightKg: number | null;
  reputation: SellerReputation;
  shippingMode: ShippingMode;
  freeShipping: boolean | null;
  condition: "new" | "used" | "unknown";
  /** true = cuenta con `seller_reputation_synced_at` (sync ML); distinto de tier desconocido con sync. */
  accountReputationSynced?: boolean;
};

export type { SellerReputationState };

export type ShippingCostEstimate = {
  sellerShippingCost: number | null;
  buyerShippingCost: number | null;
  totalEstimatedShippingCost: number | null;
  priceBand: PriceBand | null;
  weightBand: WeightBand | null;
  reputationGroup: ShippingReputationGroup;
  source:
    | "ml_ar_table_estimate"
    | "buyer_pays_shipping"
    | "missing_data"
    | "missing_reputation"
    | "missing_table"
    | "not_applicable";
  completeness: "complete" | "partial" | "not_applicable";
  reasons: string[];
  missing: string[];
};

/** Official ML AR free shipping table — only yellow / new product rows provided; no invented groups. */
export const ML_AR_FREE_SHIPPING_TABLES: Partial<
  Record<ShippingReputationGroup, Record<WeightBand, Record<PriceBand, number>>>
> = {
  yellow: {
    up_to_0_3: { under_33000: 8992, from_33000_to_49999: 6744, from_50000: 7296 },
    from_0_3_to_0_5: { under_33000: 9824, from_33000_to_49999: 7368, from_50000: 7920 },
    from_0_5_to_1: { under_33000: 11200, from_33000_to_49999: 8400, from_50000: 8964 },
    from_1_to_1_5: { under_33000: 11568, from_33000_to_49999: 8676, from_50000: 9264 },
    from_1_5_to_2: { under_33000: 11952, from_33000_to_49999: 8964, from_50000: 9564 },
    from_2_to_3: { under_33000: 13200, from_33000_to_49999: 9900, from_50000: 10452 },
    from_3_to_4: { under_33000: 14704, from_33000_to_49999: 11028, from_50000: 11832 },
    from_4_to_5: { under_33000: 16080, from_33000_to_49999: 12060, from_50000: 12912 },
    from_5_to_8: { under_33000: 17728, from_33000_to_49999: 13296, from_50000: 14196 },
    from_8_to_10: { under_33000: 19344, from_33000_to_49999: 14508, from_50000: 15408 },
    from_10_to_13: { under_33000: 20880, from_33000_to_49999: 15660, from_50000: 16704 },
    from_13_to_15: { under_33000: 22496, from_33000_to_49999: 16872, from_50000: 17916 },
    from_15_to_20: { under_33000: 26864, from_33000_to_49999: 20148, from_50000: 21396 },
    from_20_to_25: { under_33000: 32208, from_33000_to_49999: 24156, from_50000: 25704 },
    from_25_to_30: { under_33000: 44320, from_33000_to_49999: 33240, from_50000: 35292 },
    from_30_to_40: { under_33000: 50592, from_33000_to_49999: 37944, from_50000: 40284 },
    from_40_to_50: { under_33000: 53488, from_33000_to_49999: 40116, from_50000: 42588 },
    from_50_to_60: { under_33000: 59424, from_33000_to_49999: 44568, from_50000: 47532 },
    from_60_to_70: { under_33000: 61792, from_33000_to_49999: 46344, from_50000: 49548 },
    from_70_to_80: { under_33000: 71456, from_33000_to_49999: 53592, from_50000: 57420 },
    from_80_to_90: { under_33000: 88352, from_33000_to_49999: 66264, from_50000: 71016 },
    from_90_to_100: { under_33000: 101888, from_33000_to_49999: 76416, from_50000: 81876 },
    from_100_to_120: { under_33000: 111232, from_33000_to_49999: 83424, from_50000: 89388 },
    from_120_to_140: { under_33000: 125248, from_33000_to_49999: 93936, from_50000: 100668 },
    from_140_to_160: { under_33000: 139280, from_33000_to_49999: 104460, from_50000: 111936 },
    from_160_to_180: { under_33000: 153280, from_33000_to_49999: 114960, from_50000: 123192 },
    over_180: { under_33000: 167312, from_33000_to_49999: 125484, from_50000: 134472 }
  }
};

const WEIGHT_UPPER_KG: { band: WeightBand; max: number }[] = [
  { band: "up_to_0_3", max: 0.3 },
  { band: "from_0_3_to_0_5", max: 0.5 },
  { band: "from_0_5_to_1", max: 1 },
  { band: "from_1_to_1_5", max: 1.5 },
  { band: "from_1_5_to_2", max: 2 },
  { band: "from_2_to_3", max: 3 },
  { band: "from_3_to_4", max: 4 },
  { band: "from_4_to_5", max: 5 },
  { band: "from_5_to_8", max: 8 },
  { band: "from_8_to_10", max: 10 },
  { band: "from_10_to_13", max: 13 },
  { band: "from_13_to_15", max: 15 },
  { band: "from_15_to_20", max: 20 },
  { band: "from_20_to_25", max: 25 },
  { band: "from_25_to_30", max: 30 },
  { band: "from_30_to_40", max: 40 },
  { band: "from_40_to_50", max: 50 },
  { band: "from_50_to_60", max: 60 },
  { band: "from_60_to_70", max: 70 },
  { band: "from_70_to_80", max: 80 },
  { band: "from_80_to_90", max: 90 },
  { band: "from_90_to_100", max: 100 },
  { band: "from_100_to_120", max: 120 },
  { band: "from_120_to_140", max: 140 },
  { band: "from_140_to_160", max: 160 },
  { band: "from_160_to_180", max: 180 }
];

export function resolvePriceBand(price: number | null): PriceBand | null {
  if (price === null || !Number.isFinite(price)) return null;
  if (price < 33_000) return "under_33000";
  if (price < 50_000) return "from_33000_to_49999";
  return "from_50000";
}

export function resolveWeightBand(weightKg: number | null): WeightBand | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  for (const row of WEIGHT_UPPER_KG) {
    if (weightKg <= row.max) return row.band;
  }
  return "over_180";
}

export function resolveShippingReputationGroup(rep: SellerReputation): ShippingReputationGroup {
  switch (rep) {
    case "mercado_lider_green":
    case "green":
    case "no_reputation":
      return "leader_green_or_none";
    case "yellow":
      return "yellow";
    case "orange":
    case "red":
      return "orange_or_red";
    default:
      return "unknown";
  }
}

export function mapMlSellerReputation(input: {
  levelId?: string | null;
  powerSellerStatus?: string | null;
}): SellerReputation {
  const power =
    typeof input.powerSellerStatus === "string" && input.powerSellerStatus.trim().length > 0
      ? input.powerSellerStatus.trim()
      : null;
  const raw = input.levelId;
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return "unknown";
  }
  const level = String(raw).trim().toLowerCase();

  /** ML API `level_id` patterns e.g. `5_green`, `4_light_green`, `3_yellow`. */
  const isLightGreen = level.includes("light_green");
  const isGreenTier = isLightGreen || level.includes("green");

  if (level.includes("yellow")) return "yellow";
  if (level.includes("orange")) return "orange";
  if (level.includes("red")) return "red";
  if (level === "no_reputation" || level.includes("no_reputation")) return "no_reputation";

  if (power && isGreenTier) {
    return "mercado_lider_green";
  }
  if (isGreenTier) return "green";

  return "unknown";
}

/** Columna catálogo OPS — modo envío ML normalizado (no infiere envío gratis). */
export function catalogLogisticsModeColumnLabel(mode: ShippingMode): string {
  return formatMlLogisticsLabel(mode, null);
}

/**
 * Etiqueta OPS: modo logístico ML + envío gratis (solo `freeShipping` de ML o simulación explícita; nunca inferido del modo).
 */
export function formatMlLogisticsLabel(mode: ShippingMode | null, freeShipping: boolean | null): string {
  if (mode === null && freeShipping === null) return "Sin dato";
  if (mode === "retire") return "Retiro";
  if (mode === null || mode === "unknown") return "Sin dato";
  const base =
    mode === "full"
      ? "Full"
      : mode === "flex"
        ? "Flex"
        : mode === "me2"
          ? "ME2"
          : mode === "custom"
            ? "Custom"
            : "Sin dato";
  if (base === "Sin dato") return "Sin dato";
  if (freeShipping === null) return base;
  if (freeShipping === true) return `${base} gratis`;
  return base;
}

/** Convierte modo ML normalizado al enum de costos operativos del motor (tabla `pricing_skus.logistica`). */
export function shippingModeToOperatorLogistica(mode: ShippingMode): "Full" | "Flex" | "Retiro domicilio" {
  if (mode === "full") return "Full";
  if (mode === "retire") return "Retiro domicilio";
  return "Flex";
}

/** Fallback when ML API reputation not synced — maps margenes-style labels only; never defaults to green without signal. */
export function mapLegacyReputacionLabelToSellerReputation(raw: string | null | undefined): SellerReputation {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "unknown";
  const s = String(raw).toLowerCase();
  if (s.includes("mercado") && (s.includes("líder") || s.includes("lider"))) return "mercado_lider_green";
  if (s.includes("lider") && s.includes("verde")) return "mercado_lider_green";
  if (s.includes("verde")) return "green";
  if (s.includes("amarill")) return "yellow";
  if (s.includes("naranja")) return "orange";
  if (s.includes("roj")) return "red";
  return "unknown";
}

/**
 * Normaliza `shipping.logistic_type` / `shipping.mode` (ML API). No infiere envío gratis.
 * `self_service` → Flex; `drop_off` / `xd_*` → ME2; sin dato explícito → unknown (sin inventar Full/Flex).
 */
export function mapMlLogisticTypeToShippingMode(logisticType: string | null | undefined): ShippingMode {
  if (logisticType === null || logisticType === undefined || String(logisticType).trim() === "") return "unknown";
  const t = String(logisticType).toLowerCase();
  if (t.includes("fulfillment") || t === "full") return "full";
  if (t.includes("self_service")) return "flex";
  if (t.includes("retir") || t.includes("pick_up") || t.includes("store_pick_up")) return "retire";
  if (t.includes("drop_off") || t.startsWith("xd_") || t.includes("cross_docking") || t.includes("me2")) {
    return "me2";
  }
  if (t.includes("custom")) return "custom";
  if (t === "flex" || t.includes("mdd")) return "flex";
  return "unknown";
}

export function parseMlItemCondition(raw: string | null | undefined): "new" | "used" | "unknown" {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "unknown";
  const s = String(raw).toLowerCase();
  if (s === "new" || s.includes("nuevo")) return "new";
  if (s === "used" || s.includes("usado")) return "used";
  return "unknown";
}

/**
 * Envío ML: estado derivado de columnas de cuenta sincronizadas (sin fallback silencioso desde margen).
 * `legacyPricingReputacion` se mantiene en la firma por compatibilidad de llamadas; no afecta el tier de envío.
 */
export function resolveSellerReputationForRow(input: {
  accountLevel: string | null;
  accountPower: string | null;
  accountSyncedAt: string | null;
  legacyPricingReputacion: string | null;
}): SellerReputation {
  void input.legacyPricingReputacion;
  const state = deriveSellerReputationStateFromPersistedAccount(input.accountSyncedAt, input.accountLevel, input.accountPower);
  if (state === "no_reputation") {
    return "no_reputation";
  }
  if (state === "rated") {
    return mapMlSellerReputation({ levelId: input.accountLevel, powerSellerStatus: input.accountPower });
  }
  return "unknown";
}

/**
 * Costo absorbido por el vendedor con envío gratis (tabla AR). `shippingMode` no entra en el cálculo del monto;
 * solo `freeShipping`, precio, peso, condición y reputación.
 */
export function estimateSellerShippingCostAr(input: ShippingCostInput): ShippingCostEstimate {
  void input.shippingMode;
  const reasons: string[] = [];
  const missing: string[] = [];
  const repGroup = resolveShippingReputationGroup(input.reputation);
  const accountRepSynced = input.accountReputationSynced !== false;

  if (input.freeShipping === false) {
    return {
      sellerShippingCost: 0,
      buyerShippingCost: null,
      totalEstimatedShippingCost: 0,
      priceBand: resolvePriceBand(input.price),
      weightBand: resolveWeightBand(input.packageWeightKg),
      reputationGroup: repGroup,
      source: "buyer_pays_shipping",
      completeness: "complete",
      reasons: ["free_shipping=false: vendedor no absorbe envío comercial."],
      missing: []
    };
  }

  if (input.freeShipping === null) {
    missing.push("free_shipping");
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand: null,
      weightBand: null,
      reputationGroup: repGroup,
      source: "missing_data",
      completeness: "partial",
      reasons: ["free_shipping desconocido — no se estima costo."],
      missing
    };
  }

  if (input.condition !== "new") {
    missing.push("condition_new_table");
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand: resolvePriceBand(input.price),
      weightBand: resolveWeightBand(input.packageWeightKg),
      reputationGroup: repGroup,
      source: "not_applicable",
      completeness: "partial",
      reasons: ["Tabla AR provista solo para producto nuevo."],
      missing
    };
  }

  if (input.price === null || !Number.isFinite(input.price)) {
    missing.push("price");
  }
  if (input.packageWeightKg === null || !Number.isFinite(input.packageWeightKg)) {
    missing.push("package_weight");
  }

  const priceBand = resolvePriceBand(input.price);
  const weightBand = resolveWeightBand(input.packageWeightKg);

  if (input.reputation === "unknown" && !accountRepSynced) {
    missing.push("ml_reputation_sync");
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand,
      weightBand,
      reputationGroup: repGroup,
      source: "missing_reputation",
      completeness: "partial",
      reasons: ["Cuenta ML sin reputación sincronizada — no se aplica tabla AR."],
      missing
    };
  }

  if (input.reputation === "unknown") {
    missing.push("ml_reputation");
  }

  if (priceBand === null || weightBand === null || input.reputation === "unknown") {
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand,
      weightBand,
      reputationGroup: repGroup,
      source: "missing_data",
      completeness: "partial",
      reasons: ["Faltan datos para tabla AR (precio, peso o reputación)."],
      missing
    };
  }

  const groupTable = ML_AR_FREE_SHIPPING_TABLES[repGroup];
  if (!groupTable) {
    missing.push("shipping_table_for_reputation");
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand,
      weightBand,
      reputationGroup: repGroup,
      source: "missing_table",
      completeness: "partial",
      reasons: [`Sin tabla AR para grupo ${repGroup}.`],
      missing
    };
  }

  const byWeight = groupTable[weightBand];
  const cost = byWeight?.[priceBand];
  if (cost === undefined || !Number.isFinite(cost)) {
    missing.push("shipping_table_for_reputation");
    return {
      sellerShippingCost: null,
      buyerShippingCost: null,
      totalEstimatedShippingCost: null,
      priceBand,
      weightBand,
      reputationGroup: repGroup,
      source: "missing_table",
      completeness: "partial",
      reasons: [`Celda vacía en tabla AR (${String(weightBand)}, ${String(priceBand)}).`],
      missing
    };
  }

  return {
    sellerShippingCost: cost,
    buyerShippingCost: 0,
    totalEstimatedShippingCost: cost,
    priceBand,
    weightBand,
    reputationGroup: repGroup,
    source: "ml_ar_table_estimate",
    completeness: "complete",
    reasons: ["Estimación tabla ML AR (envío gratis absorbido)."],
    missing: []
  };
}
