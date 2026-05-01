"use server";

import { revalidatePath } from "next/cache";
import { generateMasterCatalogExcel } from "@/lib/exports/master-catalog-export";
import { getValidAccessToken } from "@/lib/ml/auth";
import { pushPriceToML } from "@/lib/ml/endpoints/catalog";
import { syncMlCatalog } from "@/lib/ml/sync-catalog";
import { listMlCatalogItems } from "@/lib/data-v2/ml-catalog-items";
import { ensurePricingSkuForMlItem } from "@/lib/data-v2/ensure-pricing-sku-for-ml-item";
import { linkPricingSkuToItem, listUnifiedCatalog } from "@/lib/data-v2/unified-catalog.server";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { catalogStateFromItems, type CatalogState } from "@/lib/data-v2/catalog-state";
import { calcSellingPrice, coerceReputacion, normalizePct } from "@/lib/pricing/calculator";
import type { ActionResult } from "@/lib/types/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

async function gateMlAccount(mlAccountId: string): Promise<ActionResult<{ supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." };
  }

  const { data: account, error } = await supabase.from("ml_accounts").select("id").eq("id", mlAccountId).maybeSingle();
  if (error || !account) {
    return { success: false, error: "No tenés acceso a esta cuenta ML." };
  }

  return { success: true, data: { supabase } };
}

export async function ensurePricingSkuShellForItem(
  mlAccountId: string,
  itemId: string
): Promise<ActionResult<{ pricing_sku_id: string; item?: UnifiedCatalogItem }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  const ensured = await ensurePricingSkuForMlItem(gate.data.supabase, mlAccountId, itemId);
  if (!ensured.ok) {
    return { success: false, error: ensured.error };
  }

  revalidatePath("/ops/catalog");
  revalidatePath("/ops/pricing");
  revalidatePath("/ops/dashboard");

  const refreshed = await listUnifiedCatalog(mlAccountId);
  const item = refreshed.success ? refreshed.data.find((i) => i.item_id === itemId) : undefined;
  return { success: true, data: { pricing_sku_id: ensured.pricingSkuId, item } };
}

export async function triggerCatalogSync(mlAccountId: string): Promise<ActionResult<{ synced: number; errors: number; durationMs: number }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  const { data: acc, error: accErr } = await gate.data.supabase.from("ml_accounts").select("seller_id").eq("id", mlAccountId).maybeSingle();
  if (accErr || !acc?.seller_id) {
    return { success: false, error: "La cuenta no tiene seller_id configurado." };
  }

  try {
    const token = await getValidAccessToken("", mlAccountId);
    const result = await syncMlCatalog(mlAccountId, acc.seller_id, token);
    revalidatePath("/ops/catalog");
    revalidatePath("/ops/dashboard");
    revalidatePath("/ops/pricing");
    return { success: true, data: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar catálogo";
    return { success: false, error: msg };
  }
}

export async function exportMasterCatalog(
  mlAccountId: string,
  itemIds?: string[]
): Promise<ActionResult<{ base64: string; filename: string }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  try {
    const buf = await generateMasterCatalogExcel(mlAccountId, itemIds?.length ? { itemIds } : undefined);
    return {
      success: true,
      data: {
        base64: buf.toString("base64"),
        filename: `catalogo-maestro-${mlAccountId.slice(0, 8)}.xlsx`
      }
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo generar el Excel" };
  }
}

export async function saveCostForItem(
  mlAccountId: string,
  itemId: string,
  input: {
    costo: number;
    logistica: "Full" | "Flex" | "Retiro domicilio";
    margen_pct: number;
    publicidad_pct: number;
    reputacion?: string | null;
  }
): Promise<ActionResult<{ pricing_sku_id: string; item?: UnifiedCatalogItem }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  const supabase = gate.data.supabase;
  const cat = await listMlCatalogItems(mlAccountId);
  if (!cat.success) return cat;
  const row = cat.data.find((r) => r.item_id === itemId);
  if (!row) {
    return { success: false, error: "Publicación no encontrada en el catálogo." };
  }

  const sku = row.seller_custom_field?.trim() || row.item_id;
  const pub = normalizePct(input.publicidad_pct ?? 0);
  const margRaw = normalizePct(input.margen_pct);
  if (!Number.isFinite(margRaw) || margRaw <= 0) {
    return { success: false, error: "Ingresá un margen objetivo válido (mayor que 0)." };
  }
  const repResolved = coerceReputacion(input.reputacion);
  const calc = calcSellingPrice({
    costo: input.costo,
    logistica: input.logistica,
    publicidad_pct: pub,
    margen_pct: margRaw,
    reputacion: repResolved
  });

  const pricingPayload = {
    producto: row.title,
    costo: input.costo,
    logistica: input.logistica,
    reputacion: repResolved,
    publicidad_pct: pub,
    margen_pct: margRaw,
    precio_venta: calc.converged ? calc.precio_venta : null,
    ganancia_unit: calc.converged ? calc.ganancia_unit : null,
    roi: calc.converged ? calc.roi : null
  };

  let pricingId: string;

  if (row.pricing_sku_id) {
    const { error: updSkuErr } = await supabase.from("pricing_skus").update(pricingPayload).eq("id", row.pricing_sku_id).eq("ml_account_id", mlAccountId);
    if (updSkuErr) {
      logServerError("catalog.saveCostForItem.updateSku", updSkuErr, { mlAccountId, itemId });
      return {
        success: false,
        error: isPostgresError(updSkuErr) ? formatSupabaseError(updSkuErr) : "No se pudo actualizar la configuración",
        code: updSkuErr.code
      };
    }
    pricingId = row.pricing_sku_id;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("pricing_skus")
      .insert({
        ml_account_id: mlAccountId,
        sku,
        peso_kg: null,
        source_file: "ops_catalog_inline",
        ...pricingPayload
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      logServerError("catalog.saveCostForItem.insert", insErr ?? "missing_row", { mlAccountId, itemId });
      return {
        success: false,
        error: insErr && isPostgresError(insErr) ? formatSupabaseError(insErr) : "No se pudo guardar el costo",
        code: insErr?.code
      };
    }
    pricingId = inserted.id;

    const { error: updErr } = await supabase
      .from("ml_catalog_items")
      .update({ pricing_sku_id: pricingId })
      .eq("ml_account_id", mlAccountId)
      .eq("item_id", itemId);

    if (updErr) {
      logServerError("catalog.saveCostForItem.link", updErr, { mlAccountId, itemId });
      return {
        success: false,
        error: isPostgresError(updErr) ? formatSupabaseError(updErr) : "Costo guardado pero no se vinculó a la publicación",
        code: updErr.code
      };
    }
  }

  revalidatePath("/ops/catalog");
  revalidatePath("/ops/pricing");
  revalidatePath("/ops/dashboard");

  const refreshed = await listUnifiedCatalog(mlAccountId);
  const item = refreshed.success ? refreshed.data.find((i) => i.item_id === itemId) : undefined;
  return { success: true, data: { pricing_sku_id: pricingId, item } };
}

export async function linkSkuToItem(
  mlAccountId: string,
  itemId: string,
  pricingSkuId: string
): Promise<ActionResult<{ item?: UnifiedCatalogItem }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  const result = await linkPricingSkuToItem(mlAccountId, itemId, pricingSkuId);
  if (!result.success) return result;

  revalidatePath("/ops/catalog");
  revalidatePath("/ops/pricing");
  revalidatePath("/ops/dashboard");

  const refreshed = await listUnifiedCatalog(mlAccountId);
  const item = refreshed.success ? refreshed.data.find((i) => i.item_id === itemId) : undefined;
  return { success: true, data: { item } };
}

export async function pushOptimalPriceToML(
  mlAccountId: string,
  itemId: string,
  newPrice: number
): Promise<ActionResult<{ item_id: string; new_price: number }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { success: false, error: "Precio objetivo inválido." };
  }

  const supabase = gate.data.supabase;
  const { data: itemRow, error: itemErr } = await supabase
    .from("ml_catalog_items")
    .select("status, item_id")
    .eq("ml_account_id", mlAccountId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (itemErr || !itemRow) {
    return { success: false, error: "Publicación no encontrada." };
  }
  if (String(itemRow.status ?? "").toLowerCase() !== "active") {
    return { success: false, error: "Solo se puede actualizar precio en publicaciones activas." };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken("", mlAccountId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo obtener token ML" };
  }

  const push = await pushPriceToML(itemId, newPrice, accessToken);
  const nowIso = new Date().toISOString();

  if (push.success && push.new_price !== null) {
    const { error: updErr } = await supabase
      .from("ml_catalog_items")
      .update({
        price: push.new_price,
        last_price_push_at: nowIso,
        last_price_push_value: push.new_price,
        last_price_push_status: "success"
      })
      .eq("ml_account_id", mlAccountId)
      .eq("item_id", itemId);

    if (updErr) {
      logServerError("catalog.pushOptimalPriceToML.db_success", updErr, { mlAccountId, itemId });
    }
    revalidatePath("/ops/catalog");
    revalidatePath("/ops/pricing");
    revalidatePath("/ops/dashboard");
    return { success: true, data: { item_id: itemId, new_price: push.new_price } };
  }

  const { error: errUpd } = await supabase
    .from("ml_catalog_items")
    .update({
      last_price_push_at: nowIso,
      last_price_push_status: "error"
    })
    .eq("ml_account_id", mlAccountId)
    .eq("item_id", itemId);

  if (errUpd) {
    logServerError("catalog.pushOptimalPriceToML.db_error", errUpd, { mlAccountId, itemId });
  }

  revalidatePath("/ops/catalog");
  revalidatePath("/ops/pricing");
  return { success: false, error: push.error ?? "Error al actualizar precio en ML" };
}

export async function loadUnifiedCatalogForAccount(mlAccountId: string): Promise<ActionResult<UnifiedCatalogItem[]>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;
  return listUnifiedCatalog(mlAccountId);
}

export async function reloadCatalogState(mlAccountId: string): Promise<ActionResult<CatalogState>> {
  const res = await listUnifiedCatalog(mlAccountId);
  if (!res.success) return res;
  return { success: true, data: catalogStateFromItems(res.data) };
}

export async function bulkMarkNoAds(
  mlAccountId: string,
  pricingSkuIds: string[]
): Promise<ActionResult<{ updated: number; items: UnifiedCatalogItem[] }>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  if (!pricingSkuIds.length) {
    return { success: false, error: "Seleccioná al menos una fila con SKU configurado." };
  }

  const supabase = gate.data.supabase;
  const { error, data } = await supabase
    .from("pricing_skus")
    .update({ publicidad_pct: 0 })
    .eq("ml_account_id", mlAccountId)
    .in("id", pricingSkuIds)
    .select("id");

  if (error) {
    logServerError("catalog.bulkMarkNoAds", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo actualizar publicidad",
      code: error.code
    };
  }

  revalidatePath("/ops/catalog");
  revalidatePath("/ops/pricing");

  const refreshed = await listUnifiedCatalog(mlAccountId);
  const idSet = new Set(pricingSkuIds);
  const items =
    refreshed.success && refreshed.data.length
      ? refreshed.data.filter((i) => i.pricing_sku_id !== null && idSet.has(i.pricing_sku_id as string))
      : [];

  return { success: true, data: { updated: data?.length ?? 0, items } };
}
