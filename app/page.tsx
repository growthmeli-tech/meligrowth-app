import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/internal/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileV2 } = await supabase.from("users_v2").select("role").eq("id", user.id).maybeSingle();
  const role = profileV2?.role as UserRoleV2 | undefined;

  if (role) {
    redirect(getDefaultRouteForRole(role));
  }

  redirect("/login");
}
