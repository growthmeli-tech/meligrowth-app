import type { MlCatalogItem } from "@/lib/ml/endpoints/catalog";
import { parseMlCatalogApiItemBody } from "@/lib/ml/endpoints/catalog";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog.types";
import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";

export type RootCauseCode =
  | "A_RAW_ABSENT"
  | "B_PARSER_DROP"
  | "C_DB_PERSISTENCE_DROP"
  | "D_UNIFIED_NORMALIZATION_DROP"
  | "E_PRICING_ROW_LEGACY_OVERRIDE"
  | "F_UI_LABEL_FORMAT_ERROR"
  | "G_REPUTATION_MESSAGE_ERROR";

export type ShippingDataTrace = {
  itemId: string;
  raw: {
    freeShipping: boolean | null | "__missing_key__";
    mode: string | null;
    logisticType: string | null;
    tags: unknown;
    methods: unknown;
    dimensions: string | null;
    localPickUp: boolean | null;
    storePickUp: boolean | null;
    price: number | null;
    stock: number | null;
    categoryId: string | null;
    listingTypeId: string | null;
    condition: string | null;
  };
  db: {
    freeShipping: boolean | null | "__missing_key__";
    freeShippingKeyPresent: boolean | null;
    shippingMode: string | null;
    logisticType: string | null;
    shippingTags: unknown;
    shippingMethods: unknown;
    dimensions: string | null;
    price: number | null;
    stock: number | null;
    categoryId: string | null;
    listingTypeId: string | null;
    condition: string | null;
  };
  unified: {
    freeShipping: boolean | null;
    shippingMode: string | null;
    rawMode: string | null;
    rawLogisticType: string | null;
    packageWeightKg: number | null;
    price: number | null;
    stock: number | null;
    label: string | null;
    dataTrust: unknown;
  };
  pricing: {
    displayedPrice: number | null;
    displayedStock: number | null;
    logisticsLabel: string | null;
    sellerShippingApplied: boolean | null;
    cashInAmount: number | null;
    businessDecisionType: string | null;
    decisionMessage: string | null;
  };
};

function rawShippingFromPayload(body: Record<string, unknown>): Record<string, unknown> | null {
  const s = body.shipping;
  return s && typeof s === "object" ? (s as Record<string, unknown>) : null;
}

function rawTraceFromApiBody(body: Record<string, unknown>): ShippingDataTrace["raw"] {
  const sh = rawShippingFromPayload(body);
  const hasFs = sh ? Object.prototype.hasOwnProperty.call(sh, "free_shipping") : false;
  let freeShipping: boolean | null | "__missing_key__" = "__missing_key__";
  if (sh && hasFs) {
    if (typeof sh.free_shipping === "boolean") freeShipping = sh.free_shipping;
    else if (sh.free_shipping === null) freeShipping = null;
    else freeShipping = null;
  }
  const mode = sh && typeof sh.mode === "string" ? sh.mode : null;
  const logisticType =
    sh && typeof sh.logistic_type === "string"
      ? sh.logistic_type
      : typeof body.logistic_type === "string"
        ? (body.logistic_type as string)
        : null;
  const tags = sh && Array.isArray(sh.tags) ? sh.tags : [];
  const methods = sh && Array.isArray(sh.methods) ? sh.methods : [];
  const dimensions = sh && typeof sh.dimensions === "string" ? sh.dimensions : null;
  const localPickUp = sh && typeof sh.local_pick_up === "boolean" ? sh.local_pick_up : sh?.local_pick_up === null ? null : null;
  const storePickUp = sh && typeof sh.store_pick_up === "boolean" ? sh.store_pick_up : sh?.store_pick_up === null ? null : null;
  const price = typeof body.price === "number" ? body.price : Number(body.price);
  const aq = body.available_quantity;
  const stock = typeof aq === "number" ? aq : Number(aq);
  return {
    freeShipping,
    mode,
    logisticType,
    tags,
    methods,
    dimensions,
    localPickUp,
    storePickUp,
    price: Number.isFinite(price) ? price : null,
    stock: Number.isFinite(stock) ? stock : null,
    categoryId: typeof body.category_id === "string" ? body.category_id : null,
    listingTypeId: typeof body.listing_type_id === "string" ? body.listing_type_id : null,
    condition: typeof body.condition === "string" ? body.condition : null
  };
}

function dbTraceFromCatalogItem(parsed: MlCatalogItem, dbRow?: Record<string, unknown> | null): ShippingDataTrace["db"] {
  const r = dbRow ?? {};
  const keyPresent =
    typeof r.free_shipping_key_present === "boolean"
      ? r.free_shipping_key_present
      : typeof parsed.free_shipping_key_present === "boolean"
        ? parsed.free_shipping_key_present
        : null;
  let freeShipping: boolean | null | "__missing_key__" = "__missing_key__";
  if (keyPresent === false) freeShipping = "__missing_key__";
  else if (parsed.free_shipping === true || parsed.free_shipping === false) freeShipping = parsed.free_shipping;
  else if (parsed.free_shipping === null && keyPresent === true) freeShipping = null;
  return {
    freeShipping,
    freeShippingKeyPresent: keyPresent,
    shippingMode: parsed.shipping_mode,
    logisticType: parsed.logistic_type,
    shippingTags: parsed.shipping_tags,
    shippingMethods: parsed.shipping_methods,
    dimensions: parsed.shipping_dimensions,
    price: parsed.price,
    stock: parsed.available_quantity,
    categoryId: parsed.category_id,
    listingTypeId: parsed.listing_type_id,
    condition: parsed.condition || null
  };
}

export function buildShippingDataTrace(input: {
  itemId: string;
  rawBody: Record<string, unknown>;
  parsedCatalog: MlCatalogItem | null;
  dbRow?: Record<string, unknown> | null;
  unified?: UnifiedCatalogItem | null;
}): ShippingDataTrace {
  const { itemId, rawBody, parsedCatalog, dbRow, unified } = input;
  const raw = rawTraceFromApiBody(rawBody);
  const parsed = parsedCatalog ?? parseMlCatalogApiItemBody(rawBody);
  const db = parsed ? dbTraceFromCatalogItem(parsed, dbRow) : {
    freeShipping: "__missing_key__" as const,
    freeShippingKeyPresent: null,
    shippingMode: null,
    logisticType: null,
    shippingTags: [],
    shippingMethods: [],
    dimensions: null,
    price: null,
    stock: null,
    categoryId: null,
    listingTypeId: null,
    condition: null
  };

  const unifiedOut: ShippingDataTrace["unified"] = unified
    ? {
        freeShipping: unified.mlOfficial.freeShipping,
        shippingMode: unified.mlOfficial.shippingMode,
        rawMode: unified.mlOfficial.shippingModeRaw,
        rawLogisticType: unified.mlOfficial.logisticTypeRaw,
        packageWeightKg: unified.mlOfficial.packageWeightKg,
        price: unified.price_ml,
        stock: unified.stock,
        label: unified.mlOfficial.publicationLogisticsLabel,
        dataTrust: unified.dataTrust
      }
    : {
        freeShipping: null,
        shippingMode: null,
        rawMode: null,
        rawLogisticType: null,
        packageWeightKg: null,
        price: null,
        stock: null,
        label: null,
        dataTrust: null
      };

  const ds: SkuDecisionState | null = unified?.decisionState ?? null;
  const ship = ds?.computed.financialBreakdown?.shipping ?? null;
  const pricing: ShippingDataTrace["pricing"] = ds
    ? {
        displayedPrice: ds.ml.currentPrice,
        displayedStock: ds.ml.stock,
        logisticsLabel: unified?.mlOfficial.publicationLogisticsLabel ?? null,
        sellerShippingApplied:
          ship !== null && ship.sellerShippingCost !== null && Number.isFinite(ship.sellerShippingCost)
            ? ship.sellerShippingCost > 0
            : ship?.sellerShippingCost === 0
              ? false
              : null,
        cashInAmount: ds.computed.cashInAmount,
        businessDecisionType: ds.businessDecision.type,
        decisionMessage: ds.businessDecision.message
      }
    : {
        displayedPrice: null,
        displayedStock: null,
        logisticsLabel: null,
        sellerShippingApplied: null,
        cashInAmount: null,
        businessDecisionType: null,
        decisionMessage: null
      };

  return { itemId, raw, db, unified: unifiedOut, pricing };
}

export function classifyShippingTraceMismatch(t: ShippingDataTrace): RootCauseCode[] {
  const out: RootCauseCode[] = [];
  if (t.raw.freeShipping === "__missing_key__") out.push("A_RAW_ABSENT");

  if (t.raw.freeShipping !== "__missing_key__" && t.db.freeShipping === "__missing_key__") {
    out.push("B_PARSER_DROP");
  }

  if (
    typeof t.raw.freeShipping === "boolean" &&
    t.db.freeShipping !== "__missing_key__" &&
    typeof t.db.freeShipping === "boolean" &&
    t.raw.freeShipping !== t.db.freeShipping
  ) {
    out.push("C_DB_PERSISTENCE_DROP");
  }

  if (t.unified.label && t.pricing.logisticsLabel && t.unified.label !== t.pricing.logisticsLabel) {
    out.push("F_UI_LABEL_FORMAT_ERROR");
  }

  if (t.pricing.decisionMessage?.includes("Falta reputación ML de cuenta")) {
    out.push("G_REPUTATION_MESSAGE_ERROR");
  }

  return out;
}
