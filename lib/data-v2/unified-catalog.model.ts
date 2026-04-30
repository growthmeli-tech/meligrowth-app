import { normalizePct, type LogisticaType, type SellerFinancialSettings } from "@/lib/pricing/calculator";
import { getCachedDecisionState } from "@/lib/pricing/decision-state-cache";
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

function mlSliceFromUnifiedCatalogItem(row: UnifiedCatalogItem): MlSlice {
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
    free_shipping: row.decisionState.ml.freeShipping,
    shipping_mode: row.decisionState.ml.shippingMode,
    condition: row.decisionState.ml.condition,
    package_weight_kg: row.decisionState.ml.packageWeightKg
  };
}

function pricingSkuFromUnifiedItem(row: UnifiedCatalogItem, mlAccountId: string): PricingSkuRow | null {
  if (!row.pricing_sku_id || !row.tiene_costo) return null;
  return {
    id: row.pricing_sku_id,
    ml_account_id: mlAccountId,
    sku: row.sku ?? row.seller_custom_field,
    producto: row.title,
    costo: row.costo ?? 0,
    logistica: (row.logistica ?? "Flex") as LogisticaType,
    reputacion: row.reputacion,
    publicidad_pct: row.publicidad_pct,
    margen_pct: row.margen_pct,
    peso_kg: row.peso_kg,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    created_at: row.last_synced_at,
    updated_at: row.last_synced_at
  } as PricingSkuRow;
}

/** Rebuild one catalog row after account-level fiscal settings change (cache must be invalidated first). */
export function recomputeCatalogItemFinancials(
  mlAccountId: string,
  row: UnifiedCatalogItem,
  accountFinancialSettings: SellerFinancialSettings | null,
  accountReputation: {
    sellerReputationLevel: string | null;
    sellerPowerSellerStatus: string | null;
    sellerReputationSyncedAt: string | null;
  } | null = null
): UnifiedCatalogItem {
  const derived = computeUnifiedCatalogDerived(
    mlAccountId,
    mlSliceFromUnifiedCatalogItem(row),
    pricingSkuFromUnifiedItem(row, mlAccountId),
    accountFinancialSettings,
    accountReputation
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
    ...derived
  };
}

/**
 * Pure derivation for tests, `listUnifiedCatalog` (server), and client reconciliation.
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
  } | null = null
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
  const tiene_costo = Boolean(pricing);

  const price_ml = ml.price === null || ml.price === undefined ? null : Number(ml.price);
  const stock = ml.available_quantity === null || ml.available_quantity === undefined ? null : Number(ml.available_quantity);
  const ventas_30d =
    ml.ventas_30d === null || ml.ventas_30d === undefined || Number.isNaN(Number(ml.ventas_30d))
      ? null
      : Number(ml.ventas_30d);

  const productCost =
    pricing && Number.isFinite(Number(pricing.costo)) && Number(pricing.costo) >= 0 ? Number(pricing.costo) : null;

  const pkgFromMl =
    ml.package_weight_kg !== null && ml.package_weight_kg !== undefined && Number.isFinite(Number(ml.package_weight_kg))
      ? Number(ml.package_weight_kg)
      : null;
  const pkgFromPricing =
    pricing?.peso_kg !== null && pricing?.peso_kg !== undefined && Number.isFinite(Number(pricing.peso_kg))
      ? Number(pricing.peso_kg)
      : null;
  const packageWeightCombined = pkgFromMl ?? pkgFromPricing;

  const decisionInput: BuildSkuDecisionStateInput = {
    accountId: mlAccountId,
    accountReputation: accountReputation ?? undefined,
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
      freeShipping: ml.free_shipping ?? null,
      categoryId: null,
      listingType: null,
      condition: ml.condition ?? null,
      packageWeightKg: packageWeightCombined
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
    costo: pricing ? Number(pricing.costo) : null,
    peso_kg: pricing?.peso_kg !== null && pricing?.peso_kg !== undefined ? Number(pricing.peso_kg) : null,
    logistica: pricing?.logistica ?? null,
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
    decisionState
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
    free_shipping: row.decisionState.ml.freeShipping,
    shipping_mode: row.decisionState.ml.shippingMode,
    condition: row.decisionState.ml.condition,
    package_weight_kg: row.decisionState.ml.packageWeightKg
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

  const derived = computeUnifiedCatalogDerived(mlAccountId, ml, pricingMinimal, accountFinancialSettings, null);
  return {
    ml_row_id: row.ml_row_id,
    item_id: row.item_id,
    title: row.title,
    permalink: row.permalink,
    thumbnail: row.thumbnail,
    last_synced_at: row.last_synced_at,
    seller_custom_field: row.seller_custom_field,
    logistic_type: row.logistic_type,
    ...derived
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
    free_shipping: row.decisionState.ml.freeShipping,
    shipping_mode: row.decisionState.ml.shippingMode,
    condition: row.decisionState.ml.condition,
    package_weight_kg: row.decisionState.ml.packageWeightKg
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

  const derived = computeUnifiedCatalogDerived(mlAccountId, ml, pricing, accountFinancialSettings, null);
  return {
    ml_row_id: row.ml_row_id,
    item_id: row.item_id,
    title: row.title,
    permalink: row.permalink,
    thumbnail: row.thumbnail,
    last_synced_at: row.last_synced_at,
    seller_custom_field: row.seller_custom_field,
    logistic_type: row.logistic_type,
    ...derived
  };
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
        free_shipping: fuzzy.decisionState.ml.freeShipping,
        shipping_mode: fuzzy.decisionState.ml.shippingMode,
        condition: fuzzy.decisionState.ml.condition,
        package_weight_kg: fuzzy.decisionState.ml.packageWeightKg
      });
    }
  }

  return out;
}
