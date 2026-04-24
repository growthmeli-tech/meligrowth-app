"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function redirectPath(role: "operator" | "client") {
  return role === "client" ? "/client/notifications" : "/operator/notifications";
}

export async function markNotificationRead(notificationId: string) {
  const profile = await getCurrentProfile();

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.from("notifications").update({ leida: true }).eq("id", notificationId).eq("user_id", profile.id);
  }

  revalidatePath("/operator/notifications");
  revalidatePath("/client/notifications");
  revalidatePath("/operator/dashboard");
  revalidatePath("/client/dashboard");
  redirect(redirectPath(profile.role));
}

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.from("notifications").update({ leida: true }).eq("user_id", profile.id).eq("leida", false);
  }

  revalidatePath("/operator/notifications");
  revalidatePath("/client/notifications");
  revalidatePath("/operator/dashboard");
  revalidatePath("/client/dashboard");
  redirect(redirectPath(profile.role));
}
