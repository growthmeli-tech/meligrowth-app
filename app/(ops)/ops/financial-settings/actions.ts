"use server";

import { upsertFinancialSettingsForAccount, getFinancialSettingsForAccount } from "@/lib/data-v2/financial-settings.server";
import { requireOpsMlAccountAccess } from "@/lib/data-v2/ml-accounts";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";
import type { ActionResult } from "@/lib/types/api";

export async function saveFinancialSettingsForAccount(
  mlAccountId: string,
  input: SellerFinancialSettings
): Promise<ActionResult<SellerFinancialSettings>> {
  const gate = await requireOpsMlAccountAccess(mlAccountId);
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
