import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

serve(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const staleRunningBefore = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const oldReadNotificationsBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const staleJobs = await supabase
    .from("scraping_jobs")
    .update({
      estado: "error",
      error_msg: "Job marcado como vencido por cleanup operativo",
      finished_at: new Date().toISOString()
    })
    .eq("estado", "running")
    .lt("started_at", staleRunningBefore)
    .select("id");

  const deletedNotifications = await supabase
    .from("notifications")
    .delete()
    .eq("leida", true)
    .lt("created_at", oldReadNotificationsBefore)
    .select("id");

  return json({
    ok: true,
    staleJobsMarked: staleJobs.data?.length ?? 0,
    readNotificationsDeleted: deletedNotifications.data?.length ?? 0
  });
});
