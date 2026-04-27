"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isScraperPipelineConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { runDailyScrapingDispatch } from "@/lib/scraping/daily-dispatch";

export async function runDailyScraping(formData: FormData) {
  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  if (!isSupabaseConfigured()) {
    redirect("/operator/settings?daily_error=supabase");
  }

  if (!isScraperPipelineConfigured()) {
    redirect("/operator/settings?daily_error=scraper");
  }

  const dispatch = formData.get("dispatch") !== "0";
  const result = await runDailyScrapingDispatch({ dispatch });

  revalidatePath("/operator/settings");

  if (!result.ok || "error" in result) {
    redirect("/operator/settings?daily_error=run");
  }

  const summary = result;
  redirect(
    `/operator/settings?daily_ok=1&daily_created=${summary.created}&daily_dispatched=${summary.dispatched}&daily_skipped_clients=${summary.skippedClients}&daily_skipped_jobs=${summary.skippedJobs}&daily_consolidated=${summary.consolidated}&daily_consolidation_skipped=${summary.consolidationSkipped}`
  );
}
