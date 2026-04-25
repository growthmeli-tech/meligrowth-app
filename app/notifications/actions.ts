"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

export async function markNotificationRead(notificationId: string): Promise<ActionResult<{ read: boolean }>> {
  const profile = await getCurrentProfile();

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ leida: true })
      .eq("id", notificationId)
      .eq("user_id", profile.id);
    if (error) {
      logServerError("markNotificationRead", error, { notificationId, userId: profile.id });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo actualizar la notificacion",
        code: error.code
      };
    }
  }

  revalidatePath("/operator/notifications");
  revalidatePath("/client/notifications");
  revalidatePath("/operator/dashboard");
  revalidatePath("/client/dashboard");
  return { success: true, data: { read: true } };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ readAll: boolean }>> {
  const profile = await getCurrentProfile();

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ leida: true })
      .eq("user_id", profile.id)
      .eq("leida", false);
    if (error) {
      logServerError("markAllNotificationsRead", error, { userId: profile.id });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron actualizar las notificaciones",
        code: error.code
      };
    }
  }

  revalidatePath("/operator/notifications");
  revalidatePath("/client/notifications");
  revalidatePath("/operator/dashboard");
  revalidatePath("/client/dashboard");
  return { success: true, data: { readAll: true } };
}
