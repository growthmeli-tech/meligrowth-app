"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

function getDefaultRouteForRole(role: UserRoleV2) {
  switch (role) {
    case "super_admin_meli_growth":
    case "internal_operator_meli_growth":
      return "/internal/dashboard";
    case "client_manager":
      return "/brand/dashboard";
    case "client_operator":
      return "/ops/dashboard";
    default:
      return "/login";
  }
}

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/internal/dashboard");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid");
  }

  const { data: profileV2 } = await supabase.from("users_v2").select("role").eq("id", user.id).maybeSingle();
  const role = profileV2?.role as UserRoleV2 | undefined;

  if (role) {
    redirect(getDefaultRouteForRole(role));
  }

  const { data: legacyProfile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  redirect(legacyProfile?.role === "client" ? "/brand/dashboard" : "/internal/dashboard");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
