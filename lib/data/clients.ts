import { redirect } from "next/navigation";
import {
  actions as mockActions,
  clients as mockClients,
  diagnostics as mockDiagnostics,
  files as mockFiles,
  getClientBundle as getMockClientBundle,
  meliSessions as mockMeliSessions,
  users as mockUsers
} from "@/lib/mock-data";
import {
  CLIENT_ACTION_LIMIT,
  CLIENT_FILE_LIMIT,
  CLIENT_HISTORY_LIMIT
} from "@/lib/config/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Action,
  Client,
  ClientFile,
  Diagnostic,
  Estado,
  MeliSession,
  OnboardingStatus,
  ScrapingJobSummary,
  User
} from "@/lib/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
type ActionRow = Database["public"]["Tables"]["actions"]["Row"];
type FileRow = Database["public"]["Tables"]["client_files"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type HistoryRow = Database["public"]["Tables"]["score_history"]["Row"];
type MeliSessionRow = Database["public"]["Tables"]["meli_sessions"]["Row"];
type ScrapingJobRow = Database["public"]["Tables"]["scraping_jobs"]["Row"];
type DiagnosticMapperRow = Pick<
  DiagnosticRow,
  | "id"
  | "client_id"
  | "date"
  | "score_global"
  | "estado_global"
  | "reclamos"
  | "mediaciones"
  | "cancelaciones_vendedor"
  | "envios_a_tiempo"
  | "score_salud"
  | "pubs_activas_pct"
  | "pubs_optimizadas_pct"
  | "ctr"
  | "score_publicaciones"
  | "margen_pre_ads"
  | "gasto_ads"
  | "ventas_ads"
  | "ventas_totales"
  | "acos"
  | "roas"
  | "tacos"
  | "score_ads"
  | "incidencias_pct"
  | "uso_full_flex_pct"
  | "cancelaciones_stock_pct"
  | "score_logistica"
  | "skus_sin_stock_pct"
  | "dias_stock"
  | "lead_time_reposicion"
  | "sistema_reposicion"
  | "score_stock"
  | "source"
>;

const numberOrZero = (value: number | null) => Number(value ?? 0);

export function mapUser(row: Pick<UserRow, "id" | "email" | "role" | "name">): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name ?? row.email
  };
}

export function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    plan: row.plan,
    operatorId: row.operator_id ?? "",
    clientUserId: row.client_user_id ?? undefined,
    meliAccountUrl: row.meli_account_url ?? "",
    meliSellerId: row.meli_seller_id ?? "",
    active: row.active,
    lastUpdatedAt: row.created_at
  };
}

function mapDiagnostic(row: DiagnosticMapperRow): Diagnostic {
  return {
    id: row.id,
    clientId: row.client_id,
    date: row.date,
    salud: {
      reclamos: numberOrZero(row.reclamos),
      mediaciones: numberOrZero(row.mediaciones),
      cancelaciones_vendedor: numberOrZero(row.cancelaciones_vendedor),
      envios_a_tiempo: numberOrZero(row.envios_a_tiempo)
    },
    publicaciones: {
      pubs_activas_pct: numberOrZero(row.pubs_activas_pct),
      pubs_optimizadas_pct: numberOrZero(row.pubs_optimizadas_pct),
      ctr: numberOrZero(row.ctr)
    },
    ads: {
      margen_pre_ads: numberOrZero(row.margen_pre_ads),
      gasto_ads: numberOrZero(row.gasto_ads),
      ventas_ads: numberOrZero(row.ventas_ads),
      ventas_totales: numberOrZero(row.ventas_totales),
      acos: numberOrZero(row.acos),
      roas: numberOrZero(row.roas),
      tacos: numberOrZero(row.tacos)
    },
    logistica: {
      incidencias_pct: numberOrZero(row.incidencias_pct),
      uso_full_flex_pct: numberOrZero(row.uso_full_flex_pct),
      cancelaciones_stock_pct: numberOrZero(row.cancelaciones_stock_pct)
    },
    stock: {
      skus_sin_stock_pct: numberOrZero(row.skus_sin_stock_pct),
      dias_stock: numberOrZero(row.dias_stock),
      lead_time_reposicion: numberOrZero(row.lead_time_reposicion),
      sistema_reposicion: numberOrZero(row.sistema_reposicion)
    },
    scoreGlobal: numberOrZero(row.score_global),
    estadoGlobal: row.estado_global as Estado,
    scores: {
      salud: numberOrZero(row.score_salud),
      publicaciones: numberOrZero(row.score_publicaciones),
      ads: numberOrZero(row.score_ads),
      logistica: numberOrZero(row.score_logistica),
      stock: numberOrZero(row.score_stock)
    },
    source: row.source
  };
}

function mapAction(
  row: Pick<ActionRow, "id" | "client_id" | "bloque" | "titulo" | "descripcion" | "prioridad" | "estado" | "due_date" | "completed_at" | "created_at">
): Action {
  return {
    id: row.id,
    clientId: row.client_id,
    bloque: row.bloque as Action["bloque"],
    titulo: row.titulo,
    descripcion: row.descripcion ?? "",
    prioridad: row.prioridad,
    estado: row.estado,
    responsable: "Operador asignado",
    dueDate: row.due_date ?? row.created_at,
    completedAt: row.completed_at ?? undefined
  };
}

function mapFile(
  row: Pick<FileRow, "id" | "client_id" | "tipo" | "filename" | "size_bytes" | "procesado" | "error_procesamiento" | "created_at">
): ClientFile {
  return {
    id: row.id,
    clientId: row.client_id,
    tipo: row.tipo,
    filename: row.filename,
    sizeBytes: row.size_bytes ?? 0,
    procesado: row.procesado,
    errorProcesamiento: row.error_procesamiento ?? undefined,
    createdAt: row.created_at
  };
}

function mapHistory(
  row: Pick<HistoryRow, "client_id" | "date" | "score_global" | "score_salud" | "score_pubs" | "score_ads" | "score_logistica" | "score_stock">
) {
  return {
    clientId: row.client_id,
    date: row.date,
    scoreGlobal: numberOrZero(row.score_global),
    salud: numberOrZero(row.score_salud),
    publicaciones: numberOrZero(row.score_pubs),
    ads: numberOrZero(row.score_ads),
    logistica: numberOrZero(row.score_logistica),
    stock: numberOrZero(row.score_stock)
  };
}

function mapMeliSession(row: MeliSessionRow): MeliSession {
  return {
    id: row.id,
    clientId: row.client_id,
    sellerId: row.seller_id ?? undefined,
    storagePath: row.storage_path,
    status: row.status,
    source: row.source,
    lastValidatedAt: row.last_validated_at ?? undefined,
    lastError: row.last_error ?? undefined,
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function isPlaceholderDiagnostic(diagnostic: Diagnostic) {
  return diagnostic.id === "new";
}

export function getClientOnboardingStatus({
  client,
  diagnostic,
  files
}: {
  client: Client;
  diagnostic: Diagnostic;
  files?: ClientFile[];
}): OnboardingStatus {
  if (!client.clientUserId) return "sin_acceso";
  if (isPlaceholderDiagnostic(diagnostic)) return "sin_diagnostico";
  if (!files || files.length === 0) return "esperando_plantillas";
  return "operativa";
}

export function emptyDiagnostic(clientId: string): Diagnostic {
  return {
    id: "new",
    clientId,
    date: new Date().toISOString().slice(0, 10),
    salud: { reclamos: 0, mediaciones: 0, cancelaciones_vendedor: 0, envios_a_tiempo: 0 },
    publicaciones: { pubs_activas_pct: 0, pubs_optimizadas_pct: 0, ctr: 0 },
    ads: { margen_pre_ads: 0, gasto_ads: 0, ventas_ads: 0, ventas_totales: 0, acos: 0, roas: 0, tacos: 0 },
    logistica: { incidencias_pct: 0, uso_full_flex_pct: 0, cancelaciones_stock_pct: 0 },
    stock: { skus_sin_stock_pct: 0, dias_stock: 0, lead_time_reposicion: 0, sistema_reposicion: 0 },
    scoreGlobal: 0,
    estadoGlobal: "critico",
    scores: { salud: 0, publicaciones: 0, ads: 0, logistica: 0, stock: 0 },
    source: "manual"
  };
}

export async function getCurrentProfile() {
  if (!isSupabaseConfigured()) return mockUsers[0];

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.from("users").select("id, email, role, name").eq("id", user.id).single();
  if (error || !data) redirect("/login");

  return mapUser(data);
}

export async function getLatestDiagnostic(clientId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      "id, client_id, date, score_global, estado_global, reclamos, mediaciones, cancelaciones_vendedor, envios_a_tiempo, score_salud, pubs_activas_pct, pubs_optimizadas_pct, ctr, score_publicaciones, margen_pre_ads, gasto_ads, ventas_ads, ventas_totales, acos, roas, tacos, score_ads, incidencias_pct, uso_full_flex_pct, cancelaciones_stock_pct, score_logistica, skus_sin_stock_pct, dias_stock, lead_time_reposicion, sistema_reposicion, score_stock, source, created_by, created_at"
    )
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapDiagnostic(data as DiagnosticMapperRow);
}

export function pickLatestDiagnostics(rows: DiagnosticRow[]) {
  const byClient = new Map<string, Diagnostic>();
  rows.forEach((row) => {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, mapDiagnostic(row as DiagnosticMapperRow));
  });
  return byClient;
}

export async function getOperatorClientBundle(clientId: string) {
  if (!isSupabaseConfigured()) return getMockClientBundle(clientId);

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, name, initials, plan, operator_id, client_user_id, meli_account_url, meli_seller_id, created_at, active")
    .eq("id", clientId)
    .single();
  if (!clientRow) redirect("/operator/dashboard");

  const client = mapClient(clientRow);
  const diagnostic = (await getLatestDiagnostic(client.id)) ?? emptyDiagnostic(client.id);

  const [{ data: actionRows }, { data: fileRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("actions")
      .select("id, client_id, bloque, titulo, descripcion, prioridad, estado, due_date, completed_at, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(CLIENT_ACTION_LIMIT),
    supabase
      .from("client_files")
      .select("id, client_id, tipo, filename, size_bytes, procesado, error_procesamiento, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(CLIENT_FILE_LIMIT),
    supabase
      .from("score_history")
      .select("client_id, date, score_global, score_salud, score_pubs, score_ads, score_logistica, score_stock")
      .eq("client_id", client.id)
      .order("date", { ascending: false })
      .limit(CLIENT_HISTORY_LIMIT)
  ]);

  return {
    client: { ...client, lastUpdatedAt: diagnostic.date },
    diagnostic,
    operator: profile,
    actions: (actionRows ?? []).map(mapAction),
    files: (fileRows ?? []).map(mapFile),
    history: (historyRows ?? []).map(mapHistory).reverse()
  };
}

export async function getOperatorDiagnosticFormBundle(clientId: string) {
  if (!isSupabaseConfigured()) return getMockClientBundle(clientId);

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, name, initials, plan, operator_id, client_user_id, meli_account_url, meli_seller_id, created_at, active")
    .eq("id", clientId)
    .single();
  if (!clientRow) redirect("/operator/dashboard");

  const client = mapClient(clientRow);
  const diagnostic = (await getLatestDiagnostic(client.id)) ?? emptyDiagnostic(client.id);

  return {
    client: { ...client, lastUpdatedAt: diagnostic.date },
    diagnostic,
    operator: profile,
    actions: [],
    files: [],
    history: []
  };
}

async function getOperatorClientBundleForClient(client: Client) {
  const supabase = await createServerSupabaseClient();
  const diagnostic = await getLatestDiagnostic(client.id);
  if (!diagnostic) redirect("/client/dashboard");

  const [{ data: actionRows }, { data: fileRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("actions")
      .select("id, client_id, bloque, titulo, descripcion, prioridad, estado, due_date, completed_at, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(CLIENT_ACTION_LIMIT),
    supabase
      .from("client_files")
      .select("id, client_id, tipo, filename, size_bytes, procesado, error_procesamiento, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(CLIENT_FILE_LIMIT),
    supabase
      .from("score_history")
      .select("client_id, date, score_global, score_salud, score_pubs, score_ads, score_logistica, score_stock")
      .eq("client_id", client.id)
      .order("date", { ascending: false })
      .limit(CLIENT_HISTORY_LIMIT)
  ]);

  return {
    client: { ...client, lastUpdatedAt: diagnostic.date },
    diagnostic,
    operator: undefined,
    actions: (actionRows ?? []).map(mapAction),
    files: (fileRows ?? []).map(mapFile),
    history: (historyRows ?? []).map(mapHistory).reverse()
  };
}

export async function getClientDashboardBundle() {
  if (!isSupabaseConfigured()) return getMockClientBundle("c-1");

  const profile = await getCurrentProfile();
  if (profile.role !== "client") redirect("/operator/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, name, initials, plan, operator_id, client_user_id, meli_account_url, meli_seller_id, created_at, active")
    .eq("client_user_id", profile.id)
    .single();
  if (!clientRow) redirect("/login");

  return getOperatorClientBundleForClient(mapClient(clientRow));
}

export async function getClientFilesBundle() {
  const bundle = await getClientDashboardBundle();
  return { client: bundle.client, files: bundle.files };
}

export async function getAvailableClientUsers() {
  if (!isSupabaseConfigured()) return mockUsers.filter((user) => user.role === "client");

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("users").select("id, email, role, name").eq("role", "client").order("name");
  return (data ?? []).map(mapUser);
}

export async function getOperatorClientsList() {
  if (!isSupabaseConfigured()) return mockClients;

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, initials, plan, operator_id, client_user_id, meli_account_url, meli_seller_id, created_at, active")
    .eq("active", true)
    .order("name");
  return (data ?? []).map(mapClient);
}

export async function getLatestMeliSession(clientId: string) {
  if (!isSupabaseConfigured()) return mockMeliSessions.find((session) => session.clientId === clientId) ?? null;

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("meli_sessions")
    .select("id, client_id, seller_id, storage_path, status, source, last_validated_at, last_error, warnings, created_at, updated_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapMeliSession(data as MeliSessionRow) : null;
}

export async function getClientScrapingJobs(clientId: string, limit = 8): Promise<ScrapingJobSummary[]> {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "sj-client-demo-1",
        clientId,
        tipo: "salud",
        estado: "success",
        errorMsg: null,
        createdAt: new Date().toISOString()
      },
      {
        id: "sj-client-demo-2",
        clientId,
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
    .eq("client_id", clientId)
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

export const demoActions = mockActions;
export const demoDiagnostics = mockDiagnostics;
export const demoFiles = mockFiles;
