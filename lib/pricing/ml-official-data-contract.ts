import { parseMlItemCondition, type ShippingMode } from "@/lib/pricing/shipping-costs-argentina";
import { normalizeMlShipping } from "@/lib/ml/normalize-ml-shipping";
import { scrubInternalLogisticsCodesFromDisplay } from "@/lib/pricing/ml-public-logistics-label";
import {
  deriveSellerReputationStateFromPersistedAccount,
  type SellerReputationState
} from "@/lib/pricing/seller-reputation-state";
import type { LogisticsCostBreakdown } from "@/lib/pricing/logistics-operating-cost";

export type FieldSource = "ml_api" | "account_config" | "sku_config" | "local_simulation" | "missing";

/** Provenance for pricing / shipping / decision fields (value + source + confidence). */
export type FieldProvenance<T> = {
  value: T;
  source: FieldSource;
  /** high = from ML or explicit config; partial = missing inputs; unknown = not applicable. */
  confidence: "high" | "partial" | "unknown";
};

export type MlOfficialItemState = {
  itemId: string;
  sellerId: string;
  price: number | null;
  availableQuantity: number | null;
  status: string | null;
  /** Normalized from ML `shipping` via `normalizeMlShipping` (no inference from freeShipping alone). */
  shippingMode: ShippingMode;
  /** ML `shipping.mode` (API). */
  shippingModeRaw: string | null;
  /** ML `shipping.logistic_type` (API). */
  logisticTypeRaw: string | null;
  freeShipping: boolean | null;
  /** Etiqueta pública ML (sin códigos internos tipo ME2). */
  publicationLogisticsLabel: string;
  condition: "new" | "used" | "unknown";
  /** Valor crudo ML (columna `condition`). */
  conditionRaw: string | null;
  categoryId: string | null;
  listingTypeId: string | null;
  catalogProductId: string | null;
  packageWeightKg: number | null;
  packageDimensionsRaw: string | null;
  sellerReputationState: SellerReputationState;
  sellerReputationLevel: string | null;
  sellerPowerSellerStatus: string | null;
  /** ML `shipping.local_pick_up` cuando se sincroniza. */
  localPickUpMl: boolean | null;
  /** ML `shipping.store_pick_up` cuando se sincroniza. */
  storePickUpMl: boolean | null;
};

export type SkuFieldSources = {
  freeShipping: FieldSource;
  shippingMode: FieldSource;
  packageWeightKg: FieldSource;
  sellerReputationState: FieldSource;
  logisticsOperating: FieldSource;
};

export function parsePackageWeightKgFromMl(kg: number | null | undefined): number | null {
  if (kg === null || kg === undefined) return null;
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function resolveFreeShippingProvenance(input: {
  /** From ml_catalog_items.free_shipping (ML API sync). */
  mlApi: boolean | null;
  /** Session simulation only — explicit operator override; never cuenta/planilla. */
  localSimulation?: boolean | null;
}): { value: boolean | null; source: FieldSource } {
  if (input.mlApi === true || input.mlApi === false) {
    return { value: input.mlApi, source: "ml_api" };
  }
  if (input.localSimulation === true || input.localSimulation === false) {
    return { value: input.localSimulation, source: "local_simulation" };
  }
  if (input.localSimulation === null) {
    return { value: null, source: "local_simulation" };
  }
  return { value: null, source: "missing" };
}

function shippingModeSource(
  hasShippingModeString: boolean,
  hasLogisticType: boolean
): FieldSource {
  if (hasShippingModeString || hasLogisticType) return "ml_api";
  return "missing";
}

function packageWeightSource(value: number | null): FieldSource {
  if (value !== null) return "ml_api";
  return "missing";
}

export function reputationFieldSource(
  syncedAt: string | null,
  _level: string | null
): FieldSource {
  if (syncedAt === null || syncedAt === undefined || String(syncedAt).trim() === "") {
    return "missing";
  }
  return "ml_api";
}

export function mapLogisticsBreakdownToFieldSource(
  b: LogisticsCostBreakdown,
  opts: { rowInternalLogisticsSet: boolean }
): FieldSource {
  if (b.source === "retire_no_cost") return "ml_api";
  if (b.source === "flex_config") {
    return opts.rowInternalLogisticsSet ? "sku_config" : "account_config";
  }
  if (b.source === "full_config" || b.source === "custom_config") return "account_config";
  if (b.source === "missing_config" || b.source === "unknown") return "missing";
  return "missing";
}

export function buildSkuFieldSources(input: {
  freeShipping: FieldSource;
  shippingModeFromMl: { hasMode: boolean; hasLogistic: boolean };
  packageWeightKg: number | null;
  accountReputation: { sellerReputationSyncedAt: string | null; sellerReputationLevel: string | null } | null;
  logisticsBreakdown: LogisticsCostBreakdown;
  rowInternalLogisticsSet: boolean;
}): SkuFieldSources {
  return {
    freeShipping: input.freeShipping,
    shippingMode: shippingModeSource(input.shippingModeFromMl.hasMode, input.shippingModeFromMl.hasLogistic),
    packageWeightKg: packageWeightSource(input.packageWeightKg),
    sellerReputationState: input.accountReputation
      ? reputationFieldSource(
          input.accountReputation.sellerReputationSyncedAt,
          input.accountReputation.sellerReputationLevel
        )
      : "missing",
    logisticsOperating: mapLogisticsBreakdownToFieldSource(input.logisticsBreakdown, {
      rowInternalLogisticsSet: input.rowInternalLogisticsSet
    })
  };
}

/** Normaliza modo publicación ML usando `normalizeMlShipping` (tags/methods/pickup opcionales). */
export function normalizeOfficialShippingMode(
  logisticType: string | null | undefined,
  shippingModeRaw: string | null | undefined,
  opts?: {
    tags?: unknown;
    methods?: unknown;
    localPickUp?: boolean | null;
    storePickUp?: boolean | null;
    freeShipping?: boolean | null;
    freeShippingKeyPresent?: boolean;
  }
): ShippingMode {
  const n = normalizeMlShipping({
    mode: shippingModeRaw ?? null,
    logistic_type: logisticType ?? null,
    free_shipping: opts?.freeShipping ?? null,
    free_shipping_key_present: opts?.freeShippingKeyPresent,
    tags: opts?.tags,
    methods: opts?.methods,
    local_pick_up: opts?.localPickUp ?? null,
    store_pick_up: opts?.storePickUp ?? null
  });
  return n.shippingMode as ShippingMode;
}

/** Etiqueta OPS única a partir de columnas ML crudas (catálogo / `MlPublicationLink`). */
export function formatMlLogisticsPublicationLabel(input: {
  logistic_type?: string | null;
  shipping_mode?: string | null;
  free_shipping?: boolean | null;
  free_shipping_key_present?: boolean;
  shipping_tags?: unknown;
  shipping_methods?: unknown;
  local_pick_up?: boolean | null;
  store_pick_up?: boolean | null;
}): string {
  const keyPresent =
    input.free_shipping_key_present === true || input.free_shipping_key_present === false
      ? input.free_shipping_key_present
      : undefined;
  const n = normalizeMlShipping({
    mode: input.shipping_mode ?? null,
    logistic_type: input.logistic_type ?? null,
    free_shipping: input.free_shipping === true || input.free_shipping === false ? input.free_shipping : null,
    free_shipping_key_present: keyPresent,
    tags: input.shipping_tags,
    methods: input.shipping_methods,
    local_pick_up: input.local_pick_up ?? null,
    store_pick_up: input.store_pick_up ?? null
  });
  return scrubInternalLogisticsCodesFromDisplay(n.label);
}

/**
 * Only ML-synced + account reputation fields. `freeShipping` and `packageWeightKg` are API snapshots (null if absent).
 * Never uses SKU spreadsheet weight or local simulation.
 */
export function buildMlOfficialItemState(input: {
  itemId: string;
  sellerId: string;
  price: number | null;
  availableQuantity: number | null;
  status: string | null;
  shippingModeRaw: string | null;
  logisticType: string | null;
  freeShipping: boolean | null;
  freeShippingKeyPresent?: boolean | null;
  conditionRaw: string | null;
  packageWeightKgRaw: number | null;
  packageDimensionsRaw: string | null;
  categoryId: string | null;
  listingTypeId: string | null;
  catalogProductId: string | null;
  shippingTags?: string[] | null;
  shippingMethods?: unknown[] | null;
  localPickUp?: boolean | null;
  storePickUp?: boolean | null;
  sellerReputationSyncedAt: string | null;
  sellerReputationLevel: string | null;
  sellerPowerSellerStatus: string | null;
}): MlOfficialItemState {
  const sellerReputationState = deriveSellerReputationStateFromPersistedAccount(
    input.sellerReputationSyncedAt,
    input.sellerReputationLevel,
    input.sellerPowerSellerStatus
  );

  const keyPresent =
    input.freeShippingKeyPresent === true || input.freeShippingKeyPresent === false ? input.freeShippingKeyPresent : undefined;

  const norm = normalizeMlShipping({
    mode: input.shippingModeRaw ?? null,
    logistic_type: input.logisticType ?? null,
    free_shipping: input.freeShipping === true || input.freeShipping === false ? input.freeShipping : null,
    free_shipping_key_present: keyPresent,
    tags: input.shippingTags ?? [],
    methods: input.shippingMethods ?? [],
    local_pick_up: input.localPickUp ?? null,
    store_pick_up: input.storePickUp ?? null
  });

  const mlFree = input.freeShipping === true || input.freeShipping === false ? input.freeShipping : null;

  return {
    itemId: input.itemId,
    sellerId: input.sellerId,
    price: input.price,
    availableQuantity: input.availableQuantity,
    status: input.status,
    shippingMode: norm.shippingMode as ShippingMode,
    shippingModeRaw: input.shippingModeRaw,
    logisticTypeRaw: input.logisticType,
    freeShipping: mlFree,
    publicationLogisticsLabel: scrubInternalLogisticsCodesFromDisplay(norm.label),
    condition: parseMlItemCondition(input.conditionRaw),
    conditionRaw: input.conditionRaw,
    categoryId: input.categoryId,
    listingTypeId: input.listingTypeId,
    catalogProductId: input.catalogProductId ?? null,
    packageWeightKg: parsePackageWeightKgFromMl(input.packageWeightKgRaw),
    packageDimensionsRaw: input.packageDimensionsRaw,
    sellerReputationState,
    sellerReputationLevel: input.sellerReputationLevel,
    sellerPowerSellerStatus: input.sellerPowerSellerStatus,
    localPickUpMl: input.localPickUp ?? null,
    storePickUpMl: input.storePickUp ?? null
  };
}
