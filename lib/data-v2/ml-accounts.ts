import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type MlAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];
type UserAccountAccessRow = Database["public"]["Tables"]["user_account_access"]["Row"];
type UserV2Row = Database["public"]["Tables"]["users_v2"]["Row"];
export type SyncableMlAccount = Pick<MlAccountRow, "id" | "seller_id" | "company_id">;

const ML_ACCOUNT_SELECT = "id, company_id, seller_id, account_name, active, meli_account_url, created_at, updated_at";
const USER_ACCOUNT_ACCESS_SELECT = "id, user_id, ml_account_id, access_type, ops_access_enabled, created_at";
const SYNCABLE_ML_ACCOUNT_SELECT = "id, company_id, seller_id";
const INTERNAL_ROLES = ["super_admin_meli_growth", "internal_operator_meli_growth"] as const;

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

export async function getSyncableMlAccountForUser(input: {
  userId: string;
  mlAccountId: string;
}): Promise<ActionResult<SyncableMlAccount | null>> {
  const supabase = await createServerSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("users_v2")
    .select("role, company_id")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileError || !profile) {
    logServerError("data-v2.getSyncableMlAccountForUser.profile", profileError ?? "missing_profile", {
      userId: input.userId,
      mlAccountId: input.mlAccountId
    });
    return {
      success: false,
      error: profileError && isPostgresError(profileError) ? formatSupabaseError(profileError) : "No se pudo validar el usuario",
      code: profileError?.code
    };
  }

  const typedProfile = profile as Pick<UserV2Row, "role" | "company_id">;
  const isInternal = typedProfile.role === INTERNAL_ROLES[0] || typedProfile.role === INTERNAL_ROLES[1];

  if (isInternal) {
    const { data, error } = await supabase
      .from("ml_accounts")
      .select(SYNCABLE_ML_ACCOUNT_SELECT)
      .eq("id", input.mlAccountId)
      .maybeSingle();

    if (error) {
      logServerError("data-v2.getSyncableMlAccountForUser.internalAccount", error, { mlAccountId: input.mlAccountId });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo validar la cuenta ML",
        code: error.code
      };
    }

    return { success: true, data: (data as SyncableMlAccount | null) ?? null };
  }

  if (!typedProfile.company_id) {
    return { success: true, data: null };
  }

  const { data: access, error: accessError } = await supabase
    .from("user_account_access")
    .select("id")
    .eq("user_id", input.userId)
    .eq("ml_account_id", input.mlAccountId)
    .limit(1)
    .maybeSingle();

  if (accessError) {
    logServerError("data-v2.getSyncableMlAccountForUser.access", accessError, {
      userId: input.userId,
      mlAccountId: input.mlAccountId
    });
    return {
      success: false,
      error: isPostgresError(accessError) ? formatSupabaseError(accessError) : "No se pudo validar acceso a la cuenta",
      code: accessError.code
    };
  }

  if (!access) {
    return { success: true, data: null };
  }

  const { data: account, error: accountError } = await supabase
    .from("ml_accounts")
    .select(SYNCABLE_ML_ACCOUNT_SELECT)
    .eq("id", input.mlAccountId)
    .eq("company_id", typedProfile.company_id)
    .maybeSingle();

  if (accountError) {
    logServerError("data-v2.getSyncableMlAccountForUser.account", accountError, {
      userId: input.userId,
      mlAccountId: input.mlAccountId
    });
    return {
      success: false,
      error: isPostgresError(accountError) ? formatSupabaseError(accountError) : "No se pudo validar la cuenta ML",
      code: accountError.code
    };
  }

  return { success: true, data: (account as SyncableMlAccount | null) ?? null };
}

export async function listUserAccountAccessByUser(userId: string): Promise<ActionResult<UserAccountAccessRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_account_access")
    .select(USER_ACCOUNT_ACCESS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listUserAccountAccessByUser", error, { userId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar accesos de cuenta",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as UserAccountAccessRow[] };
}
