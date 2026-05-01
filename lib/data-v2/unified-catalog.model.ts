import { normalizePct, type LogisticaType, type SellerFinancialSettings } from "@/lib/pricing/calculator";
import { getCachedDecisionState } from "@/lib/pricing/decision-state-cache";
import {
  buildCatalogDataTrust,
  coerceShippingMethodsFromJson,
  coerceShippingTagsFromJson,
  resolveMlFreeShippingKeyPresentForRow
} from "@/lib/pricing/data-reliability";
import {
  deriveSellerReputationStateFromPersistedAccount,
  formatSellerReputationStateForOps
} from "@/lib/pricing/seller-reputation-state";
import { buildMlOfficialItemState, resolveFreeShippingProvenance } from "@/lib/pricing/ml-official-data-contract";
import { shippingModeToOperatorLogistica } from "@/lib/pricing/shipping-costs-argentina";
import type { BuildSkuDecisionStateInput, SkuDecisionState } from "@/lib/pricing/sku-decision-state";
import type { Database } from "@/lib/supabase/database.types";
import type { MlPublicationLink, MlSlice, UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

function normSkuKey(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

export function resolvePricingRow(
  ml: {
    pricing_sku_id: string | null;
    seller_custom_field: string | null;
    item_id: string;
  },
  byId: Map<string, PricingSkuRow>,
  bySkuKey: Map<string, PricingSkuRow>
): PricingSkuRow | null {
  if (ml.pricing_sku_id) {
    const row = byId.get(ml.pricing_sku_id);
    if (row) return row;
  }
  const k1 = normSkuKey(ml.seller_custom_field);
  if (k1 && bySkuKey.has(k1)) return bySkuKey.get(k1) ?? null;
  const k2 = normSkuKey(ml.item_id);
  if (k2 && bySkuKey.has(k2)) return bySkuKey.get(k2) ?? null;
  return null;
}

export function buildPricingIndexes(rows: PricingSkuRow[]) {
  const byId = new Map<string, PricingSkuRow>();
  const bySkuKey = new Map<string, PricingSkuRow>();
  for (const r of rows) {
    byId.set(r.id, r);
    const k = normSkuKey(r.sku);
    if (k && !bySkuKey.has(k)) bySkuKey.set(k, r);
  }
  return { byId, bySkuKey };
}

function mapDecisionStockToLegacy(s: SkuDecisionState["decision"]["stockStatus"]): UnifiedCatalogItem["stock_status"] {
  if (s === "critical") return "critico";
  if (s === "replenish") return "reponer";
  if (s === "healthy") return "saludable";
  if (s === "overstock") return "exceso";
  return null;
}

function stockUrgencyFromDecision(s: SkuDecisionState["decision"]["stockStatus"]): UnifiedCatalogItem["stock_urgency"] {
  if (s === "critical") return "urgente";
  if (s === "replenish") return "pronto";
  if (s === "healthy" || s === "overstock") return "ok";
  return "ok";
}

/** Override de sesión (simulación); no persiste. Resolución: ML boolean gana sobre simulación. */
export type LocalShippingPolicyOverride = { overrideFreeShipping: boolean | null };

export type ComputeUnifiedCatalogOptions = {
  sellerId: string;
  accountDefaultFreeShipping?: boolean | null;
  /** Solo simulación de catálogo; `undefined` = no hay fila de simulación para este item. */
  localSimulationFreeShipping?: boolean | null | undefined;
  categoryId?: string | null;
  listingTypeId?: string | null;
};

function buildRawMlSliceFromRow(row: UnifiedCatalogItem): MlSlice {
  return {
    price: row.price_ml,
    available_quantity: row.stock,
    status: row.status,
    pricing_sku_id: row.pricing_sku_id,
    seller_custom_field: row.seller_custom_field,
    item_id: row.item_id,
    sold_quantity: row.sold_quantity,
    ventas_30d: row.ventas_30d,
    title: row.title,
    thumbnail: row.thumbnail,
    permalink: row.permalink,
    revenue_30d: row.decisionState.ml.revenue30d,
    last_sale_date: row.decisionState.ml.lastSaleDate,
    logistic_type: row.logistic_type,
    free_shipping: row.mlOfficial.freeShipping,
    ml_free_shipping_key_present: row.dataTrust.mlFreeShippingKeyPresent,
    shipping_mode: row.mlOfficial.shippingModeRaw,
    condition: row.mlOfficial.conditionRaw,
    package_weight_kg: row.mlOfficial.packageWeightKg,
    shipping_tags: row.mlShippingTags,
    shipping_methods: row.mlShippingMethods,
    category_id: row.mlOfficial.categoryId,
    listing_type_id: row.mlOfficial.listingTypeId,
    catalog_product_id: row.mlOfficial.catalogProductId,
    shipping_dimensions: row.mlOfficial.packageDimensionsRaw,
    local_pick_up: row.mlOfficial.localPickUpMl,
    store_pick_up: row.mlOfficial.storePickUpMl
  };
}

function pricingSkuFromUnifiedItem(row: UnifiedCatalogItem, mlAccountId: string): PricingSkuRow | null {
  if (!row.pricing_sku_id) return null;
  const rawCost = row.costo;
  const costoVal =
    rawCost !== null && rawCost !== undefined && Number.isFinite(Number(rawCost)) && Number(rawCost) >= 0 ? Number(rawCost) : null;
  return {
    id: row.pricing_sku_id,
    ml_account_id: mlAccountId,
    sku: row.sku ?? row.seller_custom_field,
    producto: row.title,
    costo: costoVal,
    ml_item_id: null,
    logistica: shippingModeToOperatorLogistica(row.mlOfficial.shippingMode) as LogisticaType,
    reputacion: row.reputacion,
    publicidad_pct: row.publicidad_pct,
    margen_pct: row.margen_pct,
    peso_kg: row.peso_kg,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    free_shipping: null,
    created_at: row.last_synced_at,
    updated_at: row.last_synced_at
  } as PricingSkuRow;
}

/** Rebuild one catalog row after account-level fiscal settings change (cache must be invalidated first). */
export function recomputeCatalogItemFinancials(
  mlAccountId: string,
  row: UnifiedCatalogItem,
  accountFinancialSettings: SellerFinancialSettings | null,
  accountReputationParam:
    | {
        sellerReputationLevel: string | null;
        sellerPowerSellerStatus: string | null;
        sellerReputationSyncedAt: string | null;
      }
    | null
    | undefined,
  shippingPolicy?: LocalShippingPolicyOverride
): UnifiedCatalogItem {
  const accountReputation =
    accountReputationParam === undefined ? row.accountReputation : accountReputationParam;
  const localSim = shippingPolicy !== undefined ? shippingPolicy.overrideFreeShipping : undefined;
  const derived = computeUnifiedCatalogDerived(
    mlAccountId,
    buildRawMlSliceFromRow(row),
    pricingSkuFromUnifiedItem(row, mlAccountId),
    accountFinancialSettings,
    accountReputation,
    {
      sellerId: row.mlOfficial.sellerId,
      accountDefaultFreeShipping: row.accountDefaultFreeShipping,
      localSimulationFreeShipping: localSim
    }
  );
  return { ...row, ...derived };
}

/**
 * Pure derivation for tests, `listUnifiedCatalog` (server), and client reconciliation.
 * `ml.free_shipping` debe ser el booleano bruto de ML; la resolución aplica en este paso.
 */
export function computeUnifiedCatalogDerived(
  mlAccountId: string,
  ml: MlSlice,
  pricing: PricingSkuRow | null,
  accountFinancialSettings: SellerFinancialSettings | null = null,
  accountReputation: {
    sellerReputationLevel: string | null;
    sellerPowerSellerStatus: string | null;
    sellerReputationSyncedAt: string | null;
  } | null = null,
  options?: ComputeUnifiedCatalogOptions
): Omit<
  UnifiedCatalogItem,
  | "ml_row_id"
  | "item_id"
  | "title"
  | "permalink"
  | "thumbnail"
  | "last_synced_at"
  | "seller_custom_field"
  | "logistic_type"
  | "status"
> & { price_ml: number | null; stock: number | null; sold_quantity: number | null; status: string } {
  const price_ml = ml.price === null || ml.price === undefined ? null : Number(ml.price);
  const stock = ml.available_quantity === null || ml.available_quantity === undefined ? null : Number(ml.available_quantity);
  const ventas_30d =
    ml.ventas_30d === null || ml.ventas_30d === undefined || Number.isNaN(Number(ml.ventas_30d))
      ? null
      : Number(ml.ventas_30d);

  const productCost =
    pricing && pricing.costo !== null && pricing.costo !== undefined && Number.isFinite(Number(pricing.costo)) && Number(pricing.costo) >= 0
      ? Number(pricing.costo)
      : null;

  const tiene_costo = productCost !== null;

  const sellerId = options?.sellerId ?? "unknown_seller";
  const accountDefFs = options?.accountDefaultFreeShipping ?? null;
  const localSimFs = options?.localSimulationFreeShipping;

  const accountRepForOfficial = {
    sellerReputationLevel: accountReputation?.sellerReputationLevel ?? null,
    sellerPowerSellerStatus: accountReputation?.sellerPowerSellerStatus ?? null,
    sellerReputationSyncedAt: accountReputation?.sellerReputationSyncedAt ?? null
  };

  const shippingTagsSrc = ml.shipping_tags;
  const shippingTags = Array.isArray(shippingTagsSrc)
    ? shippingTagsSrc.filter((x): x is string => typeof x === "string")
    : coerceShippingTagsFromJson(shippingTagsSrc);
  const shippingMethodsSrc = ml.shipping_methods;
  const shippingMethods = Array.isArray(shippingMethodsSrc)
    ? [...shippingMethodsSrc]
    : coerceShippingMethodsFromJson(shippingMethodsSrc);
  const mlKeyPresent = resolveMlFreeShippingKeyPresentForRow(ml.ml_free_shipping_key_present, ml.free_shipping);
  const fsKeyForOfficial = mlKeyPresent === true || mlKeyPresent === false ? mlKeyPresent : undefined;

  const mlOfficial = buildMlOfficialItemState({
    itemId: ml.item_id,
    sellerId,
    price: price_ml,
    availableQuantity: stock,
    status: ml.status,
    shippingModeRaw: ml.shipping_mode ?? null,
    logisticType: ml.logistic_type ?? null,
    freeShipping: ml.free_shipping === true || ml.free_shipping === false ? ml.free_shipping : null,
    freeShippingKeyPresent: fsKeyForOfficial,
    conditionRaw: ml.condition !== null && ml.condition !== undefined && String(ml.condition).trim() !== "" ? String(ml.condition) : null,
    packageWeightKgRaw: ml.package_weight_kg as number | null,
    packageDimensionsRaw: ml.shipping_dimensions ?? null,
    categoryId: ml.category_id ?? options?.categoryId ?? null,
    listingTypeId: ml.listing_type_id ?? options?.listingTypeId ?? null,
    catalogProductId: ml.catalog_product_id ?? null,
    shippingTags,
    shippingMethods,
    localPickUp: ml.local_pick_up ?? null,
    storePickUp: ml.store_pick_up ?? null,
    sellerReputationSyncedAt: accountRepForOfficial.sellerReputationSyncedAt,
    sellerReputationLevel: accountRepForOfficial.sellerReputationLevel,
    sellerPowerSellerStatus: accountRepForOfficial.sellerPowerSellerStatus
  });

  const freeRes = resolveFreeShippingProvenance({
    mlApi: mlOfficial.freeShipping,
    localSimulation: localSimFs
  });

  const accountRepState = deriveSellerReputationStateFromPersistedAccount(
    accountReputation?.sellerReputationSyncedAt ?? null,
    accountReputation?.sellerReputationLevel ?? null,
    accountReputation?.sellerPowerSellerStatus ?? null
  );
  const cuenta_reputacion_ml = formatSellerReputationStateForOps(accountRepState, accountReputation?.sellerReputationLevel ?? null);

  const decisionInput: BuildSkuDecisionStateInput = {
    accountId: mlAccountId,
    accountReputation: accountReputation ?? undefined,
    freeShippingSource: freeRes.source,
    ml: {
      itemId: ml.item_id,
      sku: pricing?.sku ?? ml.seller_custom_field ?? null,
      title: ml.title ?? null,
      imageUrl: ml.thumbnail ?? null,
      currentPrice: price_ml,
      stock,
      ventas30d: ventas_30d,
      revenue30d:
        ml.revenue_30d === null || ml.revenue_30d === undefined || !Number.isFinite(Number(ml.revenue_30d))
          ? null
          : Number(ml.revenue_30d),
      lastSaleDate: ml.last_sale_date ?? null,
      shippingMode: ml.shipping_mode ?? null,
      freeShipping: freeRes.value,
      categoryId: ml.category_id ?? options?.categoryId ?? null,
      listingType: ml.listing_type_id ?? options?.listingTypeId ?? null,
      condition: ml.condition ?? null,
      packageWeightKg: mlOfficial.packageWeightKg,
      logisticType: ml.logistic_type ?? null,
      shippingTags,
      shippingMethods,
      localPickUp: ml.local_pick_up ?? null,
      storePickUp: ml.store_pick_up ?? null,
      mlFreeShippingKeyPresent: mlKeyPresent
    },
    inputs: {
      productCost,
      logistics: pricing?.logistica ?? null,
      publicidadPct: pricing?.publicidad_pct ?? undefined,
      targetMarginPct:
        pricing?.margen_pct !== null && pricing?.margen_pct !== undefined ? Number(pricing.margen_pct) : null,
      pesoKg: pricing?.peso_kg !== null && pricing?.peso_kg !== undefined ? Number(pricing.peso_kg) : null,
      reputacion: pricing?.reputacion ?? null
    },
    financialSettings: accountFinancialSettings
  };
  const cacheSkuId = pricing?.id ?? `${mlAccountId}:${ml.item_id}`;
  const decisionState = getCachedDecisionState(cacheSkuId, decisionInput);

  const precio_calculado = decisionState.computed.optimalPrice;
  const ganancia_calculada = decisionState.computed.optimalGananciaUnit;
  const roi_calculado = decisionState.computed.optimalRoi;

  let precio_vs_objetivo: "sobre" | "bajo" | "ok" | null = null;
  let desviacion_precio_pct: number | null = null;
  let precio_desviado = false;
  if (price_ml !== null && precio_calculado !== null && precio_calculado > 0) {
    desviacion_precio_pct = Math.round(((price_ml - precio_calculado) / precio_calculado) * 10_000) / 100;
    precio_desviado = Math.abs(price_ml - precio_calculado) / precio_calculado > 0.05;
    const tol = 0.02;
    if (price_ml < precio_calculado * (1 - tol)) precio_vs_objetivo = "bajo";
    else if (price_ml > precio_calculado * (1 + tol)) precio_vs_objetivo = "sobre";
    else precio_vs_objetivo = "ok";
  }

  const stockStatusLegacy = mapDecisionStockToLegacy(decisionState.decision.stockStatus);
  const stock_critico =
    decisionState.decision.stockStatus === "critical" || (String(ml.status ?? "").toLowerCase() === "active" && stock === 0);

  const gap = decisionState.computed.stockGap;
  const units_to_buy =
    gap !== null && Number.isFinite(gap) && gap > 0 ? Math.max(0, Math.ceil(gap)) : gap !== null && gap <= 0 ? 0 : null;

  const margen_pct_out =
    pricing?.margen_pct !== null && pricing?.margen_pct !== undefined ? normalizePct(pricing.margen_pct) : null;

  const margen_en_riesgo =
    decisionState.computed.realMarginPct !== null &&
    decisionState.computed.realMarginPct >= 0 &&
    decisionState.computed.realMarginPct < 0.1 &&
    tiene_costo &&
    price_ml !== null;

  const sin_configurar = !tiene_costo;

  const mlRawFsBool = ml.free_shipping === true || ml.free_shipping === false ? ml.free_shipping : null;
  const dataTrust = buildCatalogDataTrust({
    priceMl: price_ml,
    productCost,
    stock,
    mlFreeShippingBoolean: mlRawFsBool,
    mlFreeShippingKeyPresent: mlKeyPresent,
    mlPackageWeightKg: mlOfficial.packageWeightKg,
    effectiveFreeShipping: freeRes.value,
    shippingTags,
    shippingMethods
  });

  return {
    price_ml,
    stock,
    sold_quantity: ml.sold_quantity === null || ml.sold_quantity === undefined ? null : Number(ml.sold_quantity),
    status: ml.status ?? "—",
    ventas_30d,
    precio_calculado,
    ganancia_calculada,
    roi_calculado,
    pricing_sku_id: pricing?.id ?? null,
    sku: pricing?.sku ?? null,
    costo:
      pricing !== null && pricing.costo !== null && pricing.costo !== undefined && Number.isFinite(Number(pricing.costo))
        ? Number(pricing.costo)
        : null,
    peso_kg: pricing?.peso_kg !== null && pricing?.peso_kg !== undefined ? Number(pricing.peso_kg) : null,
    logistica: pricing?.logistica ?? null,
    cuenta_reputacion_ml,
    reputacion: pricing?.reputacion ?? null,
    publicidad_pct: pricing?.publicidad_pct !== null && pricing?.publicidad_pct !== undefined ? Number(pricing.publicidad_pct) : null,
    margen_pct: margen_pct_out,
    tiene_costo,
    precio_desviado,
    stock_critico,
    margen_en_riesgo,
    sin_configurar,
    ganancia_real: decisionState.computed.realProfit,
    margen_real_pct: decisionState.computed.realMarginPct,
    comision_real: decisionState.computed.realComisionAmount,
    envio_real: decisionState.computed.realShippingAmount,
    publicidad_real: decisionState.computed.realAdsAmount,
    stock_status: stockStatusLegacy,
    units_to_buy,
    days_remaining: decisionState.computed.daysOfStock,
    stock_urgency: stockUrgencyFromDecision(decisionState.decision.stockStatus),
    precio_vs_objetivo,
    desviacion_precio_pct,
    decisionState,
    mlOfficial,
    accountDefaultFreeShipping: accountDefFs,
    accountReputation: {
      sellerReputationLevel: accountRepForOfficial.sellerReputationLevel,
      sellerPowerSellerStatus: accountRepForOfficial.sellerPowerSellerStatus,
      sellerReputationSyncedAt: accountRepForOfficial.sellerReputationSyncedAt
    },
    mlShippingTags: shippingTags,
    mlShippingMethods: shippingMethods,
    dataTrust
  };
}

/** Client reconciliation after `saveCostForItem` without a full navigation refresh. */
export function mergeCatalogRowAfterCostSave(
  mlAccountId: string,
  row: UnifiedCatalogItem,
  saved: {
    pricing_sku_id: string;
    costo: number;
    logistica: LogisticaType;
    margen_pct: number;
    publicidad_pct: number;
    reputacion: string | null;
  },
  accountFinancialSettings: SellerFinancialSettings | null = null
): UnifiedCatalogItem {
  const ml: MlSlice = {
    price: row.price_ml,
    available_quantity: row.stock,
    status: row.status,
    pricing_sku_id: saved.pricing_sku_id,
    seller_custom_field: row.seller_custom_field,
    item_id: row.item_id,
    sold_quantity: row.sold_quantity,
    ventas_30d: row.ventas_30d,
    title: row.title,
    thumbnail: row.thumbnail,
    permalink: row.permalink,
    revenue_30d: row.decisionState.ml.revenue30d,
    last_sale_date: row.decisionState.ml.lastSaleDate,
    logistic_type: row.logistic_type,
    free_shipping: row.mlOfficial.freeShipping,
    ml_free_shipping_key_present: row.dataTrust.mlFreeShippingKeyPresent,
    shipping_mode: row.mlOfficial.shippingModeRaw,
    condition: row.mlOfficial.conditionRaw,
    package_weight_kg: row.mlOfficial.packageWeightKg,
    shipping_tags: row.mlShippingTags,
    shipping_methods: row.mlShippingMethods,
    category_id: row.mlOfficial.categoryId,
    listing_type_id: row.mlOfficial.listingTypeId,
    catalog_product_id: row.mlOfficial.catalogProductId,
    shipping_dimensions: row.mlOfficial.packageDimensionsRaw,
    local_pick_up: row.mlOfficial.localPickUpMl,
    store_pick_up: row.mlOfficial.storePickUpMl
  };
  const pricingMinimal = {
    id: saved.pricing_sku_id,
    ml_account_id: mlAccountId,
    sku: row.sku ?? row.seller_custom_field,
    producto: row.title,
    costo: saved.costo,
    logistica: saved.logistica,
    reputacion: saved.reputacion,
    publicidad_pct: saved.publicidad_pct,
    margen_pct: saved.margen_pct,
    peso_kg: row.peso_kg
  } as PricingSkuRow;

  const derived = computeUnifiedCatalogDerived(
    mlAccountId,
    ml,
    pricingMinimal,
    accountFinancialSettings,
    row.accountReputation,
    { sellerId: row.mlOfficial.sellerId, accountDefaultFreeShipping: row.accountDefaultFreeShipping }
  );
  return {
    ml_row_id: row.ml_row_id,
    item_id: row.item_id,
    title: row.title,
    permalink: row.permalink,
    thumbnail: row.thumbnail,
    last_synced_at: row.last_synced_at,
    seller_custom_field: row.seller_custom_field,
    logistic_type: row.logistic_type,
    ...derived,
    cuenta_reputacion_ml: row.cuenta_reputacion_ml
  };
}

/** Client reconciliation after `pushOptimalPriceToML` when `new_price` is known. */
export function mergeCatalogRowAfterMlPricePush(
  mlAccountId: string,
  row: UnifiedCatalogItem,
  newPrice: number,
  accountFinancialSettings: SellerFinancialSettings | null = null
): UnifiedCatalogItem {
  const ml: MlSlice = {
    price: newPrice,
    available_quantity: row.stock,
    status: row.status,
    pricing_sku_id: row.pricing_sku_id,
    seller_custom_field: row.seller_custom_field,
    item_id: row.item_id,
    sold_quantity: row.sold_quantity,
    ventas_30d: row.ventas_30d,
    title: row.title,
    thumbnail: row.thumbnail,
    permalink: row.permalink,
    revenue_30d: row.decisionState.ml.revenue30d,
    last_sale_date: row.decisionState.ml.lastSaleDate,
    logistic_type: row.logistic_type,
    free_shipping: row.mlOfficial.freeShipping,
    ml_free_shipping_key_present: row.dataTrust.mlFreeShippingKeyPresent,
    shipping_mode: row.mlOfficial.shippingModeRaw,
    condition: row.mlOfficial.conditionRaw,
    package_weight_kg: row.mlOfficial.packageWeightKg,
    shipping_tags: row.mlShippingTags,
    shipping_methods: row.mlShippingMethods,
    category_id: row.mlOfficial.categoryId,
    listing_type_id: row.mlOfficial.listingTypeId,
    catalog_product_id: row.mlOfficial.catalogProductId,
    shipping_dimensions: row.mlOfficial.packageDimensionsRaw,
    local_pick_up: row.mlOfficial.localPickUpMl,
    store_pick_up: row.mlOfficial.storePickUpMl
  };
  const pricing =
    row.pricing_sku_id && row.tiene_costo
      ? ({
          id: row.pricing_sku_id,
          ml_account_id: mlAccountId,
          sku: row.sku ?? row.seller_custom_field,
          producto: row.title,
          costo: row.costo ?? 0,
          logistica: row.logistica,
          reputacion: row.reputacion,
          publicidad_pct: row.publicidad_pct,
          margen_pct: row.margen_pct,
          peso_kg: row.peso_kg
        } as PricingSkuRow)
      : null;

  const derived = computeUnifiedCatalogDerived(
    mlAccountId,
    ml,
    pricing,
    accountFinancialSettings,
    row.accountReputation,
    { sellerId: row.mlOfficial.sellerId, accountDefaultFreeShipping: row.accountDefaultFreeShipping }
  );
  return {
    ml_row_id: row.ml_row_id,
    item_id: row.item_id,
    title: row.title,
    permalink: row.permalink,
    thumbnail: row.thumbnail,
    last_synced_at: row.last_synced_at,
    seller_custom_field: row.seller_custom_field,
    logistic_type: row.logistic_type,
    ...derived,
    cuenta_reputacion_ml: row.cuenta_reputacion_ml
  };
}

/** Una fila de pricing por publicación ML, mismo orden que el catálogo unificado (cobertura 1:1). */
export function orderPricingSkusByUnifiedCatalog(
  unified: UnifiedCatalogItem[],
  pricingRows: PricingSkuRow[]
): PricingSkuRow[] {
  const byId = new Map(pricingRows.map((r) => [r.id, r]));
  const byMlItem = new Map<string, PricingSkuRow>();
  for (const r of pricingRows) {
    const k = r.ml_item_id?.trim();
    if (k && !byMlItem.has(k)) byMlItem.set(k, r);
  }
  const ordered: PricingSkuRow[] = [];
  const seen = new Set<string>();
  for (const u of unified) {
    const itemKey = u.item_id?.trim();
    let r = u.pricing_sku_id ? byId.get(u.pricing_sku_id) : undefined;
    if (!r && itemKey) r = byMlItem.get(itemKey);
    if (r && !seen.has(r.id)) {
      ordered.push(r);
      seen.add(r.id);
    }
  }
  return ordered;
}

/** Maps pricing SKU rows to ML publication data for `/ops/pricing`. */
export function mapPricingSkusToMlLinks(pricingRows: PricingSkuRow[], unified: UnifiedCatalogItem[]): Map<string, MlPublicationLink> {
  const byPricingId = new Map<string, UnifiedCatalogItem>();
  for (const u of unified) {
    if (u.pricing_sku_id) byPricingId.set(u.pricing_sku_id, u);
  }

  const out = new Map<string, MlPublicationLink>();
  for (const p of pricingRows) {
    const direct = byPricingId.get(p.id);
    const pk = normSkuKey(p.sku);
    const fuzzy =
      direct ??
      unified.find(
        (u) =>
          (pk !== null && normSkuKey(u.seller_custom_field) === pk) || (pk !== null && normSkuKey(u.item_id) === pk)
      );
    if (fuzzy) {
      out.set(p.id, {
        item_id: fuzzy.item_id,
        permalink: fuzzy.permalink,
        stock: fuzzy.stock,
        price_ml: fuzzy.price_ml,
        ventas_30d: fuzzy.ventas_30d,
        revenue_30d: fuzzy.decisionState.ml.revenue30d,
        last_sale_date: fuzzy.decisionState.ml.lastSaleDate,
        logistic_type: fuzzy.logistic_type,
        thumbnail: fuzzy.thumbnail,
        title: fuzzy.title,
        free_shipping: fuzzy.mlOfficial.freeShipping,
        free_shipping_key_present: fuzzy.dataTrust.mlFreeShippingKeyPresent,
        shipping_mode: fuzzy.mlOfficial.shippingModeRaw,
        condition: fuzzy.mlOfficial.conditionRaw,
        package_weight_kg: fuzzy.mlOfficial.packageWeightKg,
        listing_type_id: fuzzy.mlOfficial.listingTypeId,
        category_id: fuzzy.mlOfficial.categoryId,
        shipping_tags: fuzzy.mlShippingTags,
        shipping_methods: fuzzy.mlShippingMethods,
        local_pick_up: fuzzy.mlOfficial.localPickUpMl,
        store_pick_up: fuzzy.mlOfficial.storePickUpMl,
        operabilityStatus: fuzzy.dataTrust.operabilityStatus
      });
    }
  }

  return out;
}
