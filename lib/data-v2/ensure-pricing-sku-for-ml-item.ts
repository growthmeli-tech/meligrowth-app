import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Idempotent 1:1 shell: garantiza `ml_catalog_items.pricing_sku_id` apuntando a una fila `pricing_skus`
 * con `ml_item_id` estable. No inventa costo ni margen (`costo`/`margen_pct` null hasta configuración OPS).
 */
export async function ensurePricingSkuForMlItem(
  supabase: SupabaseServerClient,
  mlAccountId: string,
  itemId: string
): Promise<{ ok: true; pricingSkuId: string } | { ok: false; error: string }> {
  const trimmedItem = itemId.trim();
  if (!trimmedItem) return { ok: false, error: "item_id inválido" };

  const { data: cat, error: catErr } = await supabase
    .from("ml_catalog_items")
    .select("id, item_id, title, seller_custom_field, pricing_sku_id")
    .eq("ml_account_id", mlAccountId)
    .eq("item_id", trimmedItem)
    .maybeSingle();

  if (catErr) return { ok: false, error: catErr.message };
  if (!cat) return { ok: false, error: "Publicación no encontrada en catálogo ML." };

  if (cat.pricing_sku_id) {
    const { data: existing } = await supabase.from("pricing_skus").select("id").eq("id", cat.pricing_sku_id).maybeSingle();
    if (existing?.id) return { ok: true, pricingSkuId: existing.id };
    await supabase.from("ml_catalog_items").update({ pricing_sku_id: null }).eq("id", cat.id);
  }

  const { data: byMlItem } = await supabase
    .from("pricing_skus")
    .select("id")
    .eq("ml_account_id", mlAccountId)
    .eq("ml_item_id", trimmedItem)
    .maybeSingle();

  if (byMlItem?.id) {
    await supabase.from("ml_catalog_items").update({ pricing_sku_id: byMlItem.id }).eq("id", cat.id);
    return { ok: true, pricingSkuId: byMlItem.id };
  }

  const skuKey = trimmedItem;
  const producto = (cat.title?.trim() || trimmedItem).slice(0, 2000);

  const insertPayload: Database["public"]["Tables"]["pricing_skus"]["Insert"] = {
    ml_account_id: mlAccountId,
    ml_item_id: trimmedItem,
    sku: skuKey,
    producto,
    costo: null,
    source_file: "ml_item_shell",
    logistica: "Flex",
    publicidad_pct: 0,
    margen_pct: null,
    reputacion: null,
    peso_kg: null
  };

  const { data: inserted, error: insErr } = await supabase.from("pricing_skus").insert(insertPayload).select("id").single();

  if (insErr || !inserted) {
    return { ok: false, error: insErr?.message ?? "No se pudo crear fila pricing_sku" };
  }

  await supabase.from("ml_catalog_items").update({ pricing_sku_id: inserted.id }).eq("id", cat.id);

  return { ok: true, pricingSkuId: inserted.id };
}

/** Batch para sync / página pricing — mismo contrato idempotente por ítem. */
export async function ensurePricingSkuShellsForAccount(
  mlAccountId: string,
  existingClient?: SupabaseServerClient
): Promise<void> {
  const supabase = existingClient ?? (await createServerSupabaseClient());
  const { data: rows, error } = await supabase.from("ml_catalog_items").select("item_id").eq("ml_account_id", mlAccountId);

  if (error || !rows?.length) return;

  for (const r of rows) {
    if (!r.item_id) continue;
    await ensurePricingSkuForMlItem(supabase, mlAccountId, r.item_id);
  }
}
