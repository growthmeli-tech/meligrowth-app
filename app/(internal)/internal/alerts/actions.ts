"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function resolveAlert(formData: FormData) {
  const alertId = String(formData.get("alert_id") ?? "");
  if (!alertId) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("alerts")
    .update({
      resuelta: true,
      resuelta_at: new Date().toISOString()
    })
    .eq("id", alertId);

  revalidatePath("/internal/alerts");
  revalidatePath("/internal/dashboard");
}
