"use server";

import { revalidatePath } from "next/cache";
import { calcSellingPrice, coerceReputacion, normalizePct, type LogisticaType } from "@/lib/pricing/calculator";
import type { Database } from "@/lib/supabase/database.types";
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

export async function savePricingSkuInputs(
  skuId: string,
  mlAccountId: string,
  inputs: {
    costo?: number;
    logistica?: string;
    publicidad_pct?: number;
    margen_pct?: number;
    reputacion?: string;
  }
): Promise<ActionResult<void>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  const supabase = gate.data.supabase;
  type SkuUpdate = Database["public"]["Tables"]["pricing_skus"]["Update"];
  const patch: SkuUpdate = {};

  if (inputs.costo !== undefined) {
    if (!Number.isFinite(inputs.costo) || inputs.costo < 0) {
      return { success: false, error: "Costo inválido." };
    }
    patch.costo = inputs.costo;
  }

  if (inputs.logistica !== undefined) {
    const L = inputs.logistica;
    if (L !== "Full" && L !== "Flex" && L !== "Retiro domicilio") {
      return { success: false, error: "Logística inválida." };
    }
    patch.logistica = L;
  }

  if (inputs.publicidad_pct !== undefined) {
    const p = inputs.publicidad_pct;
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      return { success: false, error: "Publicidad debe estar entre 0 y 1 (ej. 0.12 = 12%)." };
    }
    patch.publicidad_pct = normalizePct(p);
  }

  if (inputs.margen_pct !== undefined) {
    const m = inputs.margen_pct;
    if (!Number.isFinite(m) || m <= 0 || m > 1) {
      return { success: false, error: "Margen debe estar entre 0 y 1 (ej. 0.15 = 15%)." };
    }
    patch.margen_pct = normalizePct(m);
  }

  if (inputs.reputacion !== undefined) {
    patch.reputacion = inputs.reputacion;
  }

  if (Object.keys(patch).length === 0) {
    return { success: false, error: "No hay cambios para guardar." };
  }

  const { data: current, error: loadErr } = await supabase
    .from("pricing_skus")
    .select("costo,logistica,publicidad_pct,margen_pct,reputacion")
    .eq("id", skuId)
    .eq("ml_account_id", mlAccountId)
    .maybeSingle();

  if (loadErr || !current) {
    return { success: false, error: "SKU no encontrado." };
  }

  const merged = {
    costo: patch.costo !== undefined ? Number(patch.costo) : Number(current.costo),
    logistica: (patch.logistica !== undefined ? patch.logistica : current.logistica) as LogisticaType,
    publicidad_pct: patch.publicidad_pct !== undefined ? Number(patch.publicidad_pct) : normalizePct(current.publicidad_pct),
    margen_pct:
      patch.margen_pct !== undefined
        ? Number(patch.margen_pct)
        : normalizePct(current.margen_pct ?? 0.15) || 0.15,
    reputacion: coerceReputacion(
      patch.reputacion !== undefined ? String(patch.reputacion) : current.reputacion
    )
  };

  const calc = calcSellingPrice({
    costo: merged.costo,
    logistica: merged.logistica,
    publicidad_pct: merged.publicidad_pct,
    margen_pct: merged.margen_pct,
    reputacion: merged.reputacion
  });
  if (calc.converged && Number.isFinite(calc.precio_venta)) {
    patch.precio_venta = calc.precio_venta;
    patch.ganancia_unit = calc.ganancia_unit;
    patch.roi = calc.roi;
  }

  const { error } = await supabase
    .from("pricing_skus")
    .update(patch)
    .eq("id", skuId)
    .eq("ml_account_id", mlAccountId);

  if (error) {
    logServerError("pricing.savePricingSkuInputs", error, { skuId, mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo guardar",
      code: error.code
    };
  }

  revalidatePath("/ops/pricing");
  revalidatePath("/ops/catalog");
  revalidatePath("/ops/dashboard");
  return { success: true, data: undefined };
}
