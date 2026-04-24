"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/operator/dashboard");
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

  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  const profile = data as { role?: "operator" | "client" } | null;
  redirect(profile?.role === "client" ? "/client/dashboard" : "/operator/dashboard");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
