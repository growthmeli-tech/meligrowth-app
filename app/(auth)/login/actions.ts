"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

export type LoginState = {
  error: string | null;
};

function getDefaultRouteForRole(role: UserRoleV2 | "operator" | "client") {
  switch (role) {
    case "super_admin_meli_growth":
    case "internal_operator_meli_growth":
    case "operator":
      return "/internal/dashboard";
    case "client_manager":
    case "client":
      return "/brand/dashboard";
    case "client_operator":
      return "/ops/dashboard";
    default:
      return null;
  }
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
    const route = getDefaultRouteForRole(role);
    if (route) redirect(route);
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
  if (legacyRole) {
    const route = getDefaultRouteForRole(legacyRole);
    if (route) redirect(route);
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
