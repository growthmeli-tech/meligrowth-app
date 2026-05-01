import { auditFreeShippingContractFromParsedCatalog } from "@/lib/pricing/data-reliability";
import { getItemCatalog } from "@/lib/ml/endpoints/catalog";
import { getSellerReputation } from "@/lib/ml/endpoints/users";
import { getSalesLast30Days } from "@/lib/ml/endpoints/sales";
import { ensurePricingSkuShellsForAccount } from "@/lib/data-v2/ensure-pricing-sku-for-ml-item";
import { invalidateDecisionCacheByAccountId } from "@/lib/pricing/decision-state-cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

type CatalogInsert = Database["public"]["Tables"]["ml_catalog_items"]["Insert"];

const UPSERT_CHUNK = 80;

export async function syncMlCatalog(
  mlAccountId: string,
  sellerId: string,
  accessToken: string
): Promise<{ synced: number; errors: number; durationMs: number }> {
  const started = Date.now();
  let errors = 0;

  const items = await getItemCatalog(sellerId, accessToken, { maxItems: 200 }).catch((err) => {
    console.error("[ml-catalog:sync_complete] fetch_failed", { mlAccountId, sellerId, err });
    errors += 1;
    return [];
  });

  const fsAudit = auditFreeShippingContractFromParsedCatalog(
    items.map((i) => ({ free_shipping: i.free_shipping, free_shipping_key_present: i.free_shipping_key_present }))
  );
  console.info("[ml-catalog:free_shipping_data_contract]", {
    mlAccountId,
    sellerId,
    total: fsAudit.total,
    freeShippingKeyMissing: fsAudit.freeShippingKeyMissing,
    freeShippingExplicitNull: fsAudit.freeShippingExplicitNull,
    pctKeyMissing: fsAudit.total ? Math.round((1000 * fsAudit.freeShippingKeyMissing) / fsAudit.total) / 10 : 0,
    pctExplicitNull: fsAudit.total ? Math.round((1000 * fsAudit.freeShippingExplicitNull) / fsAudit.total) / 10 : 0
  });

  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  const rows: CatalogInsert[] = items.map((row) => ({
    ml_account_id: mlAccountId,
    item_id: row.item_id,
    title: row.title,
    price: row.price,
    available_quantity: row.available_quantity,
    sold_quantity: row.sold_quantity,
    status: row.status,
    seller_custom_field: row.seller_custom_field,
    condition: row.condition || null,
    permalink: row.permalink || null,
    thumbnail: row.thumbnail,
    logistic_type: row.logistic_type,
    free_shipping: row.free_shipping,
    free_shipping_key_present: row.free_shipping_key_present,
    shipping_mode: row.shipping_mode,
    package_weight_kg: row.package_weight_kg,
    shipping_tags: row.shipping_tags as unknown as Json,
    shipping_methods: row.shipping_methods as unknown as Json,
    listing_type_id: row.listing_type_id,
    category_id: row.category_id,
    catalog_product_id: row.catalog_product_id,
    shipping_dimensions: row.shipping_dimensions,
    local_pick_up: row.local_pick_up,
    store_pick_up: row.store_pick_up,
    last_synced_at: now
  }));

  let synced = 0;

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("ml_catalog_items").upsert(chunk, {
      onConflict: "ml_account_id,item_id",
      ignoreDuplicates: false
    });

    if (error) {
      console.error("[ml-catalog:sync_complete] upsert_chunk_failed", {
        mlAccountId,
        chunkStart: i,
        message: error.message
      });
      errors += 1;
    } else {
      synced += chunk.length;
    }
  }

  const salesData = await getSalesLast30Days(sellerId, accessToken).catch((err) => {
    console.error("[ml-sales:sync_failed]", err);
    return [];
  });

  if (salesData.length > 0) {
    for (const sale of salesData) {
      const { error: updSalesErr } = await supabase
        .from("ml_catalog_items")
        .update({
          ventas_30d: sale.units_sold_30d,
          revenue_30d: sale.revenue_30d,
          last_sale_date: sale.last_sale_date
        })
        .eq("ml_account_id", mlAccountId)
        .eq("item_id", sale.item_id);
      if (updSalesErr) {
        console.error("[ml-sales:update_row]", { mlAccountId, item_id: sale.item_id, message: updSalesErr.message });
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  try {
    const repRaw = await getSellerReputation(sellerId, accessToken);
    const payload =
      repRaw === null
        ? {
            seller_reputation_level: null as string | null,
            seller_power_seller_status: null as string | null,
            seller_reputation_synced_at: now
          }
        : {
            seller_reputation_level: repRaw.level_id ?? null,
            seller_power_seller_status: repRaw.power_seller_status ?? null,
            seller_reputation_synced_at: now
          };
    const { error: repErr } = await supabase.from("ml_accounts").update(payload).eq("id", mlAccountId);
    if (repErr) {
      console.error("[ml-catalog:seller_reputation_persist]", { mlAccountId, message: repErr.message });
    } else {
      invalidateDecisionCacheByAccountId(mlAccountId);
    }
  } catch (repCatch) {
    console.error("[ml-catalog:seller_reputation_fetch]", {
      mlAccountId,
      message: repCatch instanceof Error ? repCatch.message : String(repCatch)
    });
  }

  await ensurePricingSkuShellsForAccount(mlAccountId, supabase);

  const durationMs = Date.now() - started;

  console.info("[ml-catalog:sync_complete]", {
    mlAccountId,
    sellerId,
    synced,
    errors,
    durationMs,
    fetched: items.length,
    salesRows: salesData.length
  });

  return { synced, errors, durationMs };
}
