import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { UserRoleV2 } from "@/lib/types/enums";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type UserV2Row = Database["public"]["Tables"]["users_v2"]["Row"];
type MlAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];

export async function getCurrentViewerProfile(): Promise<ActionResult<{ userId: string; profile: UserV2Row }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logServerError("data-v2.getCurrentViewerProfile.auth", authError ?? "missing_user");
    return { success: false, error: "Sesion no valida", code: authError?.code };
  }

  const { data: profile, error: profileError } = await supabase.from("users_v2").select("*").eq("id", user.id).maybeSingle();
  if (profileError || !profile) {
    logServerError("data-v2.getCurrentViewerProfile.profile", profileError ?? "missing_profile", { userId: user.id });
    return {
      success: false,
      error: profileError && isPostgresError(profileError) ? formatSupabaseError(profileError) : "No se pudo cargar users_v2",
      code: profileError?.code
    };
  }

  return { success: true, data: { userId: user.id, profile } };
}

export async function getPrimaryAccountForManager(): Promise<ActionResult<MlAccountRow | null>> {
  const viewer = await getCurrentViewerProfile();
  if (!viewer.success) return viewer as ActionResult<MlAccountRow | null>;

  const companyId = viewer.data.profile.company_id;
  if (!companyId) return { success: true, data: null };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ml_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logServerError("data-v2.getPrimaryAccountForManager", error, { companyId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar la cuenta principal",
      code: error.code
    };
  }

  return { success: true, data: (data as MlAccountRow | null) ?? null };
}

export async function getPrimaryAccountForOperator(): Promise<ActionResult<MlAccountRow | null>> {
  const viewer = await getCurrentViewerProfile();
  if (!viewer.success) return viewer as ActionResult<MlAccountRow | null>;

  const role = viewer.data.profile.role as UserRoleV2;
  const userId = viewer.data.userId;
  const supabase = await createServerSupabaseClient();

  if (role === "client_operator" || role === "internal_operator_meli_growth") {
    const { data: accessRow, error: accessError } = await supabase
      .from("user_account_access")
      .select("ml_account_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accessError) {
      logServerError("data-v2.getPrimaryAccountForOperator.access", accessError, { userId });
      return {
        success: false,
        error: isPostgresError(accessError) ? formatSupabaseError(accessError) : "No se pudo cargar acceso de cuenta",
        code: accessError.code
      };
    }

    if (!accessRow) return { success: true, data: null };
    const { data: account, error: accountError } = await supabase.from("ml_accounts").select("*").eq("id", accessRow.ml_account_id).maybeSingle();
    if (accountError) {
      logServerError("data-v2.getPrimaryAccountForOperator.account", accountError, { userId });
      return {
        success: false,
        error: isPostgresError(accountError) ? formatSupabaseError(accountError) : "No se pudo cargar cuenta",
        code: accountError.code
      };
    }
    return { success: true, data: (account as MlAccountRow | null) ?? null };
  }

  return { success: true, data: null };
}
