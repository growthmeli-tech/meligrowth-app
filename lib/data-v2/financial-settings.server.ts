import "server-only";

import { normalizeFiscalPct, type SellerFinancialSettings } from "@/lib/pricing/calculator";
import type { Database } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type FsRow = Database["public"]["Tables"]["ml_account_financial_settings"]["Row"];

function rowToSellerFinancialSettings(row: FsRow): SellerFinancialSettings {
  return {
    iibbPct: row.iibb_pct === null || row.iibb_pct === undefined ? null : Number(row.iibb_pct),
    taxPct: row.tax_pct === null || row.tax_pct === undefined ? null : Number(row.tax_pct),
    internalLogisticsCost:
      row.internal_logistics_cost === null || row.internal_logistics_cost === undefined
        ? null
        : Number(row.internal_logistics_cost),
    additionalCostsPct:
      row.additional_costs_pct === null || row.additional_costs_pct === undefined
        ? null
        : Number(row.additional_costs_pct),
    additionalCostsFixed:
      row.additional_costs_fixed === null || row.additional_costs_fixed === undefined
        ? null
        : Number(row.additional_costs_fixed)
  };
}

/** Normalize percentage fields for persistence (0–1 canonical); null stays null; 0 stays 0. `1` from the fiscal form is 1%, not 100%. */
function normalizeFinancialSettingsForDb(input: SellerFinancialSettings): SellerFinancialSettings {
  return {
    iibbPct:
      input.iibbPct === null || input.iibbPct === undefined || !Number.isFinite(input.iibbPct)
        ? null
        : normalizeFiscalPct(input.iibbPct),
    taxPct:
      input.taxPct === null || input.taxPct === undefined || !Number.isFinite(input.taxPct)
        ? null
        : normalizeFiscalPct(input.taxPct),
    internalLogisticsCost:
      input.internalLogisticsCost === null ||
      input.internalLogisticsCost === undefined ||
      !Number.isFinite(input.internalLogisticsCost)
        ? null
        : input.internalLogisticsCost,
    additionalCostsPct:
      input.additionalCostsPct === null ||
      input.additionalCostsPct === undefined ||
      !Number.isFinite(input.additionalCostsPct)
        ? null
        : normalizeFiscalPct(input.additionalCostsPct),
    additionalCostsFixed:
      input.additionalCostsFixed === null ||
      input.additionalCostsFixed === undefined ||
      !Number.isFinite(input.additionalCostsFixed)
        ? null
        : input.additionalCostsFixed,
    fixedUnitCost:
      input.fixedUnitCost === null || input.fixedUnitCost === undefined || !Number.isFinite(input.fixedUnitCost)
        ? null
        : input.fixedUnitCost
  };
}

export async function getFinancialSettingsForAccount(mlAccountId: string): Promise<SellerFinancialSettings | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ml_account_financial_settings")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToSellerFinancialSettings(data);
}

export async function upsertFinancialSettingsForAccount(
  mlAccountId: string,
  input: SellerFinancialSettings
): Promise<SellerFinancialSettings> {
  const normalized = normalizeFinancialSettingsForDb(input);
  const supabase = await createServerSupabaseClient();

  const payload = {
    ml_account_id: mlAccountId,
    iibb_pct: normalized.iibbPct,
    tax_pct: normalized.taxPct,
    internal_logistics_cost: normalized.internalLogisticsCost,
    additional_costs_pct: normalized.additionalCostsPct,
    additional_costs_fixed: normalized.additionalCostsFixed
  };

  const { data, error } = await supabase
    .from("ml_account_financial_settings")
    .upsert(payload, { onConflict: "ml_account_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la configuración fiscal");
  }

  return rowToSellerFinancialSettings(data);
}
