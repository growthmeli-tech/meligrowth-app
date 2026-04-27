import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type MlAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];

const ML_ACCOUNT_SELECT = "id, company_id, seller_id, account_name, active, meli_account_url, created_at, updated_at";

export async function listMlAccountsByCompany(
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<ActionResult<MlAccountRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("ml_accounts")
    .select(ML_ACCOUNT_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listMlAccountsByCompany", error, { companyId, ...options });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar cuentas ML",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as MlAccountRow[] };
}

export async function listActiveMlAccountsForCompanies(companyIds: string[]): Promise<ActionResult<MlAccountRow[]>> {
  if (companyIds.length === 0) return { success: true, data: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ml_accounts")
    .select(ML_ACCOUNT_SELECT)
    .in("company_id", companyIds)
    .eq("active", true)
    .order("company_id")
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listActiveMlAccountsForCompanies", error, { companyIdsCount: companyIds.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar cuentas ML activas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as MlAccountRow[] };
}

export async function getMlAccountById(mlAccountId: string): Promise<ActionResult<MlAccountRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("ml_accounts").select(ML_ACCOUNT_SELECT).eq("id", mlAccountId).maybeSingle();

  if (error) {
    logServerError("data-v2.getMlAccountById", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar la cuenta ML",
      code: error.code
    };
  }

  return { success: true, data: (data as MlAccountRow | null) ?? null };
}
