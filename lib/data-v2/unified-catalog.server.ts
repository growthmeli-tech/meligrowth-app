import "server-only";

import { listMlCatalogItems, updateCatalogItemPricingLink } from "@/lib/data-v2/ml-catalog-items";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { getFinancialSettingsForAccount } from "@/lib/data-v2/financial-settings.server";
import type { ActionResult } from "@/lib/types/api";
import { coerceShippingMethodsFromJson, coerceShippingTagsFromJson } from "@/lib/pricing/data-reliability";
import { buildPricingIndexes, computeUnifiedCatalogDerived, resolvePricingRow } from "@/lib/data-v2/unified-catalog.model";
import type { CatalogHealthSummary, UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function listUnifiedCatalog(mlAccountId: string): Promise<ActionResult<UnifiedCatalogItem[]>> {
  const supabase = await createServerSupabaseClient();
  const [catRes, priceRes, financialRes, accRes] = await Promise.all([
    listMlCatalogItems(mlAccountId),
    listPricingSkus(mlAccountId),
    getFinancialSettingsForAccount(mlAccountId),
    supabase
      .from("ml_accounts")
      .select(
        "seller_id, default_free_shipping, seller_reputation_level, seller_power_seller_status, seller_reputation_synced_at"
      )
      .eq("id", mlAccountId)
      .maybeSingle()
  ]);
  if (!catRes.success) return catRes;
  if (!priceRes.success) return priceRes;

  const accountFinancialSettings = financialRes;

  const accountReputation = accRes.data
    ? {
        sellerReputationLevel: accRes.data.seller_reputation_level,
        sellerPowerSellerStatus: accRes.data.seller_power_seller_status,
        sellerReputationSyncedAt: accRes.data.seller_reputation_synced_at
      }
    : null;
  const sellerId = accRes.data?.seller_id?.trim() || "unknown_seller";
  const accountDefaultFree = accRes.data?.default_free_shipping ?? null;

  const { byId, bySkuKey } = buildPricingIndexes(priceRes.data);

  const unified: UnifiedCatalogItem[] = catRes.data.map((row) => {
    const pricing = resolvePricingRow(row, byId, bySkuKey);
    const derived = computeUnifiedCatalogDerived(
      mlAccountId,
      {
        price: row.price,
        available_quantity: row.available_quantity,
        status: row.status,
        pricing_sku_id: row.pricing_sku_id,
        seller_custom_field: row.seller_custom_field,
        item_id: row.item_id,
        sold_quantity: row.sold_quantity,
        ventas_30d: row.ventas_30d === null || row.ventas_30d === undefined ? null : Number(row.ventas_30d),
        title: row.title,
        thumbnail: row.thumbnail,
        permalink: row.permalink,
        revenue_30d: row.revenue_30d === null || row.revenue_30d === undefined ? null : Number(row.revenue_30d),
        last_sale_date: row.last_sale_date ?? null,
        logistic_type: row.logistic_type,
        free_shipping: row.free_shipping,
        ml_free_shipping_key_present: row.free_shipping_key_present,
        shipping_mode: row.shipping_mode,
        condition: row.condition,
        package_weight_kg: row.package_weight_kg === null || row.package_weight_kg === undefined ? null : Number(row.package_weight_kg),
        shipping_tags: coerceShippingTagsFromJson(row.shipping_tags),
        shipping_methods: coerceShippingMethodsFromJson(row.shipping_methods)
      },
      pricing,
      accountFinancialSettings,
      accountReputation,
      { sellerId, accountDefaultFreeShipping: accountDefaultFree }
    );

    return {
      ml_row_id: row.id,
      item_id: row.item_id,
      title: row.title,
      permalink: row.permalink,
      thumbnail: row.thumbnail,
      last_synced_at: row.last_synced_at,
      seller_custom_field: row.seller_custom_field,
      logistic_type: row.logistic_type,
      ...derived
    };
  });

  return { success: true, data: unified };
}

export async function linkPricingSkuToItem(
  mlAccountId: string,
  itemId: string,
  pricingSkuId: string
): Promise<ActionResult<void>> {
  return updateCatalogItemPricingLink(mlAccountId, itemId, pricingSkuId);
}

export async function getCatalogHealthSummary(mlAccountId: string): Promise<ActionResult<CatalogHealthSummary>> {
  const list = await listUnifiedCatalog(mlAccountId);
  if (!list.success) return list;

  const items = list.data;
  const totalPublications = items.length;
  const activePublications = items.filter((i) => i.status === "active").length;
  const sinStock = items.filter((i) => i.status === "active" && i.stock === 0).length;
  const sinCosto = items.filter((i) => !i.tiene_costo).length;
  const precioDesviado = items.filter((i) => i.precio_desviado).length;
  const bienConfigurados = items.filter(
    (i) => i.tiene_costo && !i.precio_desviado && !i.stock_critico && !i.margen_en_riesgo
  ).length;

  return {
    success: true,
    data: {
      totalPublications,
      activePublications,
      sinStock,
      sinCosto,
      precioDesviado,
      bienConfigurados
    }
  };
}
