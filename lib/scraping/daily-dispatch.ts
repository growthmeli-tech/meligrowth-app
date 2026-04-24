import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { consolidateScrapingClient } from "@/lib/diagnostics/consolidate-scraping";

const JOB_TYPES = ["salud", "ads", "publicaciones", "stock"] as const;

type JobType = (typeof JOB_TYPES)[number];

async function dispatchJob(jobId: string) {
  const scraperUrl = process.env.SCRAPER_SERVICE_URL?.replace(/\/$/, "");
  const scraperSecret = process.env.SCRAPER_SERVICE_SECRET;
  if (!scraperUrl || !scraperSecret) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const response = await fetch(`${scraperUrl}/jobs/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scraper-secret": scraperSecret
      },
      body: JSON.stringify({ job_id: jobId }),
      signal: controller.signal,
      cache: "no-store"
    }).finally(() => clearTimeout(timeout));
    return response.ok;
  } catch {
    return false;
  }
}

export async function runDailyScrapingDispatch(options?: { dispatch?: boolean; clientId?: string | null }) {
  const supabase = createServiceSupabaseClient();
  const shouldDispatch = options?.dispatch !== false;
  const today = new Date().toISOString().slice(0, 10);

  let clientsQuery = supabase.from("clients").select("id, name, meli_seller_id, active").eq("active", true);
  if (options?.clientId) {
    clientsQuery = clientsQuery.eq("id", options.clientId);
  }

  const { data: clients, error } = await clientsQuery;
  if (error) return { ok: false, error: error.message };

  const clientIds = (clients ?? []).map((client) => client.id);
  const { data: sessionRows, error: sessionError } =
    clientIds.length > 0
      ? await supabase
          .from("meli_sessions")
          .select("client_id, status, created_at")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  if (sessionError) return { ok: false, error: sessionError.message };

  const latestSessionByClient = new Map<string, { status: string; createdAt: string }>();
  for (const row of sessionRows ?? []) {
    if (!latestSessionByClient.has(row.client_id)) {
      latestSessionByClient.set(row.client_id, {
        status: row.status,
        createdAt: row.created_at
      });
    }
  }

  const result = {
    ok: true,
    eligibleClients: 0,
    skippedClients: 0,
    skippedMissingSession: 0,
    skippedSessionError: 0,
    created: 0,
    dispatched: 0,
    skippedJobs: 0,
    consolidated: 0,
    consolidationSkipped: 0,
    errors: 0,
    clients: [] as Array<{
      clientId: string;
      clientName: string;
      status: "processed" | "skipped_missing_session" | "skipped_session_error";
      created: number;
      dispatched: number;
      skippedJobs: number;
      consolidated: boolean;
    }>
  };

  for (const client of clients ?? []) {
    const session = latestSessionByClient.get(client.id);
    if (!session) {
      result.skippedClients += 1;
      result.skippedMissingSession += 1;
      result.clients.push({
        clientId: client.id,
        clientName: client.name,
        status: "skipped_missing_session",
        created: 0,
        dispatched: 0,
        skippedJobs: 0,
        consolidated: false
      });
      continue;
    }

    if (session.status === "error") {
      result.skippedClients += 1;
      result.skippedSessionError += 1;
      result.clients.push({
        clientId: client.id,
        clientName: client.name,
        status: "skipped_session_error",
        created: 0,
        dispatched: 0,
        skippedJobs: 0,
        consolidated: false
      });
      continue;
    }

    result.eligibleClients += 1;
    let clientCreated = 0;
    let clientDispatched = 0;
    let clientSkippedJobs = 0;
    let clientConsolidated = false;

    for (const tipo of JOB_TYPES) {
      const { data: existing } = await supabase
        .from("scraping_jobs")
        .select("id")
        .eq("client_id", client.id)
        .eq("tipo", tipo)
        .in("estado", ["pending", "running", "success"])
        .gte("created_at", `${today}T00:00:00.000Z`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        result.skippedJobs += 1;
        clientSkippedJobs += 1;
        continue;
      }

      const { data: job, error: insertError } = await supabase
        .from("scraping_jobs")
        .insert({ client_id: client.id, tipo: tipo as JobType, estado: "pending" })
        .select("id")
        .single();

      if (insertError || !job) {
        result.errors += 1;
        continue;
      }

      result.created += 1;
      clientCreated += 1;

      if (shouldDispatch) {
        const dispatched = await dispatchJob(job.id);
        if (dispatched) {
          result.dispatched += 1;
          clientDispatched += 1;
        } else {
          result.errors += 1;
        }
      }
    }

    if (shouldDispatch) {
      const consolidatedResult = await consolidateScrapingClient(client.id);
      if (consolidatedResult.ok && consolidatedResult.consolidated) {
        result.consolidated += 1;
        clientConsolidated = true;
      } else {
        result.consolidationSkipped += 1;
      }
    }

    result.clients.push({
      clientId: client.id,
      clientName: client.name,
      status: "processed",
      created: clientCreated,
      dispatched: clientDispatched,
      skippedJobs: clientSkippedJobs,
      consolidated: clientConsolidated
    });
  }

  return result;
}
