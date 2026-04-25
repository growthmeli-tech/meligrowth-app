import { redirect } from "next/navigation";
import {
  DASHBOARD_CLIENT_LIMIT,
  DEFAULT_SCRAPING_JOBS_LIMIT
} from "@/lib/config/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoDiagnostics,
  demoFiles,
  getCurrentProfile,
  mapClient,
  mapUser,
  pickLatestDiagnostics,
  emptyDiagnostic,
  isPlaceholderDiagnostic
} from "@/lib/data/clients";
import { clients as mockClients, users as mockUsers } from "@/lib/mock-data";

type ScrapingJobRow = Database["public"]["Tables"]["scraping_jobs"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

export async function getOperatorDashboardData() {
  if (!isSupabaseConfigured()) {
    return mockClients
      .map((client) => ({
        client,
        diagnostic: demoDiagnostics.find((item) => item.clientId === client.id)!,
        operator: mockUsers.find((user) => user.id === client.operatorId),
        filesCount: demoFiles.filter((file) => file.clientId === client.id).length
      }))
      .filter((item) => item.diagnostic);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRows, error } = await supabase
    .from("clients")
    .select("id, name, initials, plan, operator_id, client_user_id, meli_account_url, meli_seller_id, created_at, active")
    .eq("active", true)
    .order("name")
    .limit(DASHBOARD_CLIENT_LIMIT);
  if (error || !clientRows) return [];

  const clientIds = clientRows.map((row) => row.id);
  const { data: diagnosticRows } =
    clientIds.length > 0
      ? await supabase
          .from("diagnostics")
          .select(
            "id, client_id, date, score_global, estado_global, reclamos, mediaciones, cancelaciones_vendedor, envios_a_tiempo, score_salud, pubs_activas_pct, pubs_optimizadas_pct, ctr, score_publicaciones, margen_pre_ads, gasto_ads, ventas_ads, ventas_totales, acos, roas, tacos, score_ads, incidencias_pct, uso_full_flex_pct, cancelaciones_stock_pct, score_logistica, skus_sin_stock_pct, dias_stock, lead_time_reposicion, sistema_reposicion, score_stock, source, created_at"
          )
          .in("client_id", clientIds)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
      : { data: [] };
  const { data: fileRows } =
    clientIds.length > 0
      ? await supabase.from("client_files").select("client_id").in("client_id", clientIds)
      : { data: [] };

  const operatorIds = Array.from(new Set(clientRows.map((row) => row.operator_id).filter(Boolean))) as string[];
  const { data: operatorRows } =
    operatorIds.length > 0
      ? await supabase.from("users").select("id, email, role, name").in("id", operatorIds)
      : { data: [] };
  const operatorsById = new Map((operatorRows ?? []).map((row) => [row.id, mapUser(row)]));

  const filesCountByClient = new Map<string, number>();
  (fileRows ?? []).forEach((row) => {
    filesCountByClient.set(row.client_id, (filesCountByClient.get(row.client_id) ?? 0) + 1);
  });
  const diagnosticsByClient = pickLatestDiagnostics((diagnosticRows ?? []) as DiagnosticRow[]);

  return clientRows.map((row) => {
    const client = mapClient(row);
    const diagnostic = diagnosticsByClient.get(client.id) ?? emptyDiagnostic(client.id);
    return {
      client: { ...client, lastUpdatedAt: isPlaceholderDiagnostic(diagnostic) ? client.lastUpdatedAt : diagnostic.date },
      diagnostic,
      operator: operatorsById.get(client.operatorId) ?? profile,
      filesCount: filesCountByClient.get(client.id) ?? 0
    };
  });
}

export async function getRecentScrapingJobs(limit = DEFAULT_SCRAPING_JOBS_LIMIT) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "sj-demo-1",
        clientId: "c-1",
        tipo: "salud",
        estado: "success",
        errorMsg: null,
        createdAt: new Date().toISOString()
      },
      {
        id: "sj-demo-2",
        clientId: "c-2",
        tipo: "ads",
        estado: "pending",
        errorMsg: null,
        createdAt: new Date().toISOString()
      }
    ];
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("scraping_jobs")
    .select("id, client_id, tipo, estado, error_msg, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as ScrapingJobRow[]).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    tipo: row.tipo,
    estado: row.estado,
    errorMsg: row.error_msg,
    createdAt: row.created_at
  }));
}
