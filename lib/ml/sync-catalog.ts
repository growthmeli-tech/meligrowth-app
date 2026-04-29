import { getItemCatalog } from "@/lib/ml/endpoints/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

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

  const durationMs = Date.now() - started;

  console.info("[ml-catalog:sync_complete]", {
    mlAccountId,
    sellerId,
    synced,
    errors,
    durationMs,
    fetched: items.length
  });

  return { synced, errors, durationMs };
}
