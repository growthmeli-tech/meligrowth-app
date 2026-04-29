import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import { getCurrentViewerProfile } from "@/lib/data-v2/viewer";

/** App-side check aligned with SQL `is_meli_growth_team()`. */
export async function requireMeliGrowthTeam(): Promise<ActionResult<{ userId: string }>> {
  const viewer = await getCurrentViewerProfile();
  if (!viewer.success) {
    return { success: false, error: viewer.error, code: viewer.code };
  }
  const role = viewer.data.profile.role;
  if (role !== "super_admin_meli_growth" && role !== "internal_operator_meli_growth") {
    return { success: false, error: "Solo el equipo interno Meli Growth puede realizar esta accion", code: "FORBIDDEN" };
  }
  return { success: true, data: { userId: viewer.data.userId } };
}

export async function requireMeliGrowthTeamWithSupabase(): Promise<
  ActionResult<{ userId: string; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }>
> {
  const gate = await requireMeliGrowthTeam();
  if (!gate.success) return gate;
  const supabase = await createServerSupabaseClient();
  return { success: true, data: { userId: gate.data.userId, supabase } };
}
