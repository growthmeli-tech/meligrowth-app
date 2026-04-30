"use server";

import { upsertFinancialSettingsForAccount, getFinancialSettingsForAccount } from "@/lib/data-v2/financial-settings.server";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";
import type { ActionResult } from "@/lib/types/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function saveFinancialSettingsForAccount(
  mlAccountId: string,
  input: SellerFinancialSettings
): Promise<ActionResult<SellerFinancialSettings>> {
  const gate = await gateMlAccount(mlAccountId);
  if (!gate.success) return gate;

  try {
    await upsertFinancialSettingsForAccount(mlAccountId, input);
    const saved = await getFinancialSettingsForAccount(mlAccountId);
    if (!saved) {
      return { success: false, error: "No se pudo leer la configuración guardada." };
    }
    return { success: true, data: saved };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar configuración fiscal";
    return { success: false, error: msg };
  }
}
