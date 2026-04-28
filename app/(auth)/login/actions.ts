"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

export type LoginState = {
  error: string | null;
};

async function getClientOperatorHome(userId: string, supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: accessRow, error: accessError } = await supabase
    .from("user_account_access")
    .select("ops_access_enabled")
    .eq("user_id", userId)
    .eq("access_type", "operator")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accessError) {
    console.error("[login-action] operator_access_lookup_failed", {
      userId,
      code: accessError.code,
      message: accessError.message
    });
    return "/brand/dashboard";
  }

  return accessRow?.ops_access_enabled ? "/ops/dashboard" : "/brand/dashboard";
}

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    redirect("/internal/dashboard");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    console.error("[login-action] missing_credentials", { hasEmail: Boolean(email), hasPassword: Boolean(password) });
    return { error: "Ingresá email y password." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    console.error("[login-action] sign_in_failed", {
      email,
      code: authError.code,
      message: authError.message
    });
    return { error: "No pudimos validar esas credenciales." };
  }

  const user = authData.user;

  if (!user) {
    console.error("[login-action] missing_user_after_sign_in", { email });
    return { error: "No pudimos validar esas credenciales." };
  }

  const { data: profileV2, error: profileV2Error } = await supabase.from("users_v2").select("role").eq("id", user.id).maybeSingle();
  if (profileV2Error) {
    console.error("[login-action] users_v2_lookup_failed", {
      userId: user.id,
      code: profileV2Error.code,
      message: profileV2Error.message
    });
  }

  const role = profileV2?.role as UserRoleV2 | undefined;

  if (role) {
    if (role === "super_admin_meli_growth" || role === "internal_operator_meli_growth") {
      redirect("/internal/dashboard");
    }
    if (role === "client_manager") {
      redirect("/brand/dashboard");
    }
    if (role === "client_operator") {
      const home = await getClientOperatorHome(user.id, supabase);
      redirect(home);
    }
  }

  const { data: legacyProfile, error: legacyProfileError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (legacyProfileError) {
    console.error("[login-action] users_legacy_lookup_failed", {
      userId: user.id,
      code: legacyProfileError.code,
      message: legacyProfileError.message
    });
  }

  const legacyRole = legacyProfile?.role as "operator" | "client" | undefined;
  if (legacyRole === "operator") {
    redirect("/internal/dashboard");
  }
  if (legacyRole === "client") {
    redirect("/brand/dashboard");
  }

  console.error("[login-action] role_not_found", { userId: user.id, email });
  return { error: "Tu usuario no tiene rol asignado para esta app." };
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
