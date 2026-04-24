import { buildDiagnosticInputFromScraping, hasRequiredScrapingBlocks } from "@/lib/diagnostics/scraping-input";
import { persistDiagnostic } from "@/lib/diagnostics/persist-diagnostic";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type JobResult = {
  tipo?: string;
  metrics?: Record<string, unknown>;
};

export async function consolidateAllScrapingClients() {
  const supabase = createServiceSupabaseClient();
  const { data: clients, error } = await supabase.from("clients").select("id").eq("active", true);
  if (error) return { ok: false, error: error.message };

  const results = await Promise.all((clients ?? []).map((client) => consolidateScrapingClient(client.id)));
  return {
    ok: true,
    consolidated: results.filter((item) => item.ok && item.consolidated).length,
    skipped: results.filter((item) => item.ok && !item.consolidated).length,
    errors: results.filter((item) => !item.ok).length,
    results
  };
}

export async function consolidateScrapingClient(clientId: string) {
  const supabase = createServiceSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("diagnostics")
    .select("id")
    .eq("client_id", clientId)
    .eq("source", "scraping")
    .eq("date", today)
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: true, clientId, consolidated: false, reason: "already_consolidated_today" };

  const { data: jobs, error } = await supabase
    .from("scraping_jobs")
    .select("id, tipo, resultado_json, finished_at")
    .eq("client_id", clientId)
    .eq("estado", "success")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .order("finished_at", { ascending: false });

  if (error) return { ok: false, clientId, error: error.message };

  const latestByType = new Map<string, JobResult>();
  for (const job of jobs ?? []) {
    if (!latestByType.has(job.tipo)) {
      latestByType.set(job.tipo, job.resultado_json as JobResult);
    }
  }

  const results = [...latestByType.values()];
  if (!hasRequiredScrapingBlocks(results)) {
    return { ok: true, clientId, consolidated: false, reason: "missing_required_jobs" };
  }

  const input = buildDiagnosticInputFromScraping(results);
  const saved = await persistDiagnostic({
    supabase,
    clientId,
    input,
    date: today,
    source: "scraping",
    createdBy: null
  });

  if (!saved.ok) return { ok: false, clientId, error: saved.error };

  return {
    ok: true,
    clientId,
    consolidated: true,
    diagnosticId: saved.diagnosticId,
    scoreGlobal: saved.scoreGlobal
  };
}
