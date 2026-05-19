"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

export type LoginState = {
  error: string | null;
};

function safeRedirectPath(raw: string): string | null {
  const p = raw.trim();
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//")) return null;
  if (p.includes("://")) return null;
  return p;
}

async function getClientOperatorHome(userId: string) {
  const service = createServiceSupabaseClient();
  const { data: accessRow, error: accessError } = await service
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
  const redirectRaw = String(formData.get("redirect") ?? "");

  if (!email || !password) {
    console.error("[login] missing_credentials", { hasEmail: Boolean(email), hasPassword: Boolean(password) });
    return { error: "Email y contraseña son requeridos." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user) {
    console.error("[login] auth_error", {
      email,
      code: authError?.code,
      message: authError?.message
    });
    return { error: "Email o contraseña incorrectos." };
  }

  const userId = authData.user.id;
  const service = createServiceSupabaseClient();

  const safePostLogin = safeRedirectPath(redirectRaw);
  if (safePostLogin) {
    redirect(safePostLogin);
  }

  const { data: profileV2, error: profileV2Error } = await service.from("users_v2").select("role, company_id").eq("id", userId).maybeSingle();
  if (profileV2Error) {
    console.error("[login] users_v2_error", {
      userId,
      code: profileV2Error.code,
      message: profileV2Error.message
    });
  }

  const role = profileV2?.role as UserRoleV2 | undefined;

  if (role) {
    console.info("[login] role_found_v2", { userId, role });
    if (role === "super_admin_meli_growth" || role === "internal_operator_meli_growth") {
      redirect("/internal/dashboard");
    }
    if (role === "client_manager") {
      redirect("/brand/dashboard");
    }
    if (role === "client_operator") {
      const home = await getClientOperatorHome(userId);
      redirect(home);
    }
  }

  const { data: legacyProfile, error: legacyProfileError } = await service.from("users").select("role").eq("id", userId).maybeSingle();
  if (legacyProfileError) {
    console.error("[login] users_legacy_error", {
      userId,
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

  console.error("[login] missing_role", { userId, email, userV2: profileV2, userLegacy: legacyProfile });
  return { error: "Tu usuario no tiene un rol asignado. Contactá al administrador." };
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
