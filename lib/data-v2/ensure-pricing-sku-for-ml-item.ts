import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeOfficialShippingMode } from "@/lib/pricing/ml-official-data-contract";
import { shippingModeToOperatorLogistica } from "@/lib/pricing/shipping-costs-argentina";

export type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const SHELL_SOURCE = "ml_item_shell";

export type ReusablePricingSkuCandidate = {
  id: string;
  sku: string | null;
  costo: number | null;
  ml_item_id: string | null;
  source_file: string | null;
};

function hasProductCost(costo: number | null | undefined): boolean {
  return costo !== null && costo !== undefined && Number.isFinite(Number(costo)) && Number(costo) > 0;
}

function normSkuKey(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

/**
 * Prefer an ingested cost row over an empty ML shell. Matching order matches
 * `resolvePricingRow`: seller_custom_field, then item_id (first SKU wins).
 */
export function findReusableCostPricingSku(
  catalog: { item_id: string; seller_custom_field: string | null },
  rows: ReusablePricingSkuCandidate[]
): ReusablePricingSkuCandidate | null {
  const withCost = rows.filter((r) => hasProductCost(r.costo));
  if (withCost.length === 0) return null;
  const bySkuKey = new Map<string, ReusablePricingSkuCandidate>();
  for (const r of withCost) {
    const k = normSkuKey(r.sku);
    if (k && !bySkuKey.has(k)) bySkuKey.set(k, r);
  }
  const custom = normSkuKey(catalog.seller_custom_field);
  if (custom && bySkuKey.has(custom)) return bySkuKey.get(custom) ?? null;
  const itemKey = normSkuKey(catalog.item_id);
  if (itemKey && bySkuKey.has(itemKey)) return bySkuKey.get(itemKey) ?? null;
  return null;
}

/**
 * Idempotent 1:1 link: `ml_catalog_items.pricing_sku_id` points at a `pricing_skus`
 * row with stable `ml_item_id`. Reuses ingested cost rows when SKU matches.
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
    .select("id, item_id, title, seller_custom_field, pricing_sku_id, logistic_type, shipping_mode, shipping_tags, shipping_methods, local_pick_up, store_pick_up")
    .eq("ml_account_id", mlAccountId)
    .eq("item_id", trimmedItem)
    .maybeSingle();

  if (catErr) return { ok: false, error: catErr.message };
  if (!cat) return { ok: false, error: "Publicación no encontrada en catálogo ML." };

  if (cat.pricing_sku_id) {
    const { data: existing } = await supabase
      .from("pricing_skus")
      .select("id, sku, costo, ml_item_id, source_file")
      .eq("id", cat.pricing_sku_id)
      .maybeSingle();
    if (existing?.id && hasProductCost(existing.costo as number | null)) {
      return { ok: true, pricingSkuId: existing.id };
    }
    if (!existing?.id) {
      await supabase.from("ml_catalog_items").update({ pricing_sku_id: null }).eq("id", cat.id);
    }
  }

  const { data: accountSkus } = await supabase
    .from("pricing_skus")
    .select("id, sku, costo, ml_item_id, source_file")
    .eq("ml_account_id", mlAccountId)
    .order("updated_at", { ascending: false });

  const reusable = findReusableCostPricingSku(
    { item_id: trimmedItem, seller_custom_field: cat.seller_custom_field ?? null },
    (accountSkus ?? []) as ReusablePricingSkuCandidate[]
  );

  if (reusable) {
    const previousShellId =
      cat.pricing_sku_id && cat.pricing_sku_id !== reusable.id ? cat.pricing_sku_id : null;
    await supabase
      .from("pricing_skus")
      .update({ ml_item_id: null })
      .eq("ml_account_id", mlAccountId)
      .eq("ml_item_id", trimmedItem)
      .neq("id", reusable.id);
    await supabase.from("pricing_skus").update({ ml_item_id: trimmedItem }).eq("id", reusable.id);
    await supabase.from("ml_catalog_items").update({ pricing_sku_id: reusable.id }).eq("id", cat.id);
    if (previousShellId) {
      await supabase.from("pricing_skus").delete().eq("id", previousShellId).eq("source_file", SHELL_SOURCE);
    }
    return { ok: true, pricingSkuId: reusable.id };
  }

  if (cat.pricing_sku_id) {
    return { ok: true, pricingSkuId: cat.pricing_sku_id };
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
  const shellLogistica = shippingModeToOperatorLogistica(
    normalizeOfficialShippingMode(cat.logistic_type ?? null, cat.shipping_mode ?? null, {
      tags: cat.shipping_tags,
      methods: cat.shipping_methods,
      localPickUp: cat.local_pick_up ?? null,
      storePickUp: cat.store_pick_up ?? null
    })
  );

  const insertPayload: Database["public"]["Tables"]["pricing_skus"]["Insert"] = {
    ml_account_id: mlAccountId,
    ml_item_id: trimmedItem,
    sku: skuKey,
    producto,
    costo: null,
    source_file: SHELL_SOURCE,
    logistica: shellLogistica,
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
