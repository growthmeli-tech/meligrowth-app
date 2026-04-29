import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

export type MlCatalogItemRow = Database["public"]["Tables"]["ml_catalog_items"]["Row"];

export async function listMlCatalogItems(mlAccountId: string): Promise<ActionResult<MlCatalogItemRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ml_catalog_items")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .order("title", { ascending: true });

  if (error) {
    logServerError("ml-catalog-items.list", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar el catálogo ML",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as MlCatalogItemRow[] };
}

export async function getLatestCatalogSyncAt(mlAccountId: string): Promise<ActionResult<string | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ml_catalog_items")
    .select("last_synced_at")
    .eq("ml_account_id", mlAccountId)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logServerError("ml-catalog-items.latestSync", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo leer última sincronización",
      code: error.code
    };
  }

  return { success: true, data: data?.last_synced_at ?? null };
}

export async function updateCatalogItemPricingLink(
  mlAccountId: string,
  itemId: string,
  pricingSkuId: string | null
): Promise<ActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("ml_catalog_items")
    .update({ pricing_sku_id: pricingSkuId })
    .eq("ml_account_id", mlAccountId)
    .eq("item_id", itemId);

  if (error) {
    logServerError("ml-catalog-items.updatePricingLink", error, { mlAccountId, itemId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo vincular el SKU",
      code: error.code
    };
  }

  return { success: true, data: undefined };
}
