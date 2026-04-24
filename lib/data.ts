import { redirect } from "next/navigation";
import { actions as mockActions, clients as mockClients, diagnostics as mockDiagnostics, files as mockFiles, getClientBundle as getMockClientBundle, meliSessions as mockMeliSessions, pricingProposals as mockPricingProposals, scoreHistory as mockScoreHistory, users as mockUsers } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { Action, Client, ClientFile, Diagnostic, Estado, MeliSession, Notification, OnboardingStatus, PricingProposal, PricingTemplateFile, ScrapingJobSummary, User } from "@/lib/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
type ActionRow = Database["public"]["Tables"]["actions"]["Row"];
type FileRow = Database["public"]["Tables"]["client_files"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type HistoryRow = Database["public"]["Tables"]["score_history"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ScrapingJobRow = Database["public"]["Tables"]["scraping_jobs"]["Row"];
type PricingProposalRow = Database["public"]["Tables"]["pricing_proposals"]["Row"];
type MeliSessionRow = Database["public"]["Tables"]["meli_sessions"]["Row"];

const numberOrZero = (value: number | null) => Number(value ?? 0);
const DASHBOARD_CLIENT_LIMIT = 120;
const CLIENT_ACTION_LIMIT = 100;
const CLIENT_FILE_LIMIT = 50;
const CLIENT_HISTORY_LIMIT = 18;

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name ?? row.email
  };
}

function mapClient(row: ClientRow): Client {
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

function mapDiagnostic(row: DiagnosticRow): Diagnostic {
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

function mapAction(row: ActionRow): Action {
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

function mapFile(row: FileRow): ClientFile {
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

function mapHistory(row: HistoryRow) {
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

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    userId: row.user_id ?? undefined,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    leida: row.leida,
    createdAt: row.created_at
  };
}

function mapPricingProposal(row: PricingProposalRow, clientName: string): PricingProposal {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName,
    createdBy: row.created_by ?? undefined,
    source: row.source,
    plan: row.plan,
    currentRevenue: numberOrZero(row.current_revenue),
    projectedRevenue: numberOrZero(row.projected_revenue),
    grossMarginPct: numberOrZero(row.gross_margin_pct),
    deliveryCost: numberOrZero(row.delivery_cost),
    setupFee: numberOrZero(row.setup_fee),
    months: row.months,
    fixedFee: numberOrZero(row.fixed_fee),
    variableCommission: numberOrZero(row.variable_commission),
    monthlyFee: numberOrZero(row.monthly_fee),
    operatorProfit: numberOrZero(row.operator_profit),
    operatorMarginPct: numberOrZero(row.operator_margin_pct),
    totalContractValue: numberOrZero(row.total_contract_value),
    paybackRatio: numberOrZero(row.payback_ratio),
    recommended: row.recommended,
    notes: row.notes ?? undefined,
    createdAt: row.created_at
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

function emptyDiagnostic(clientId: string): Diagnostic {
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

  const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (error || !data) redirect("/login");

  return mapUser(data);
}

async function getLatestDiagnostic(clientId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapDiagnostic(data);
}

function pickLatestDiagnostics(rows: DiagnosticRow[]) {
  const byClient = new Map<string, Diagnostic>();

  rows.forEach((row) => {
    if (!byClient.has(row.client_id)) {
      byClient.set(row.client_id, mapDiagnostic(row));
    }
  });

  return byClient;
}

export async function getOperatorDashboardData() {
  if (!isSupabaseConfigured()) {
    return mockClients
      .map((client) => ({
        client,
        diagnostic: mockDiagnostics.find((item) => item.clientId === client.id)!,
        operator: mockUsers.find((user) => user.id === client.operatorId),
        filesCount: mockFiles.filter((file) => file.clientId === client.id).length
      }))
      .filter((item) => item.diagnostic);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRows, error } = await supabase.from("clients").select("*").eq("active", true).order("name").limit(DASHBOARD_CLIENT_LIMIT);
  if (error || !clientRows) return [];

  const clientIds = clientRows.map((row) => row.id);
  const { data: diagnosticRows } =
    clientIds.length > 0
      ? await supabase
          .from("diagnostics")
          .select("*")
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
      ? await supabase.from("users").select("*").in("id", operatorIds)
      : { data: [] };
  const operatorsById = new Map((operatorRows ?? []).map((row) => [row.id, mapUser(row as UserRow)]));
  const filesCountByClient = new Map<string, number>();
  (fileRows ?? []).forEach((row) => {
    filesCountByClient.set(row.client_id, (filesCountByClient.get(row.client_id) ?? 0) + 1);
  });
  const diagnosticsByClient = pickLatestDiagnostics((diagnosticRows ?? []) as DiagnosticRow[]);
  const bundles = clientRows.map((row) => {
    const client = mapClient(row);
    const diagnostic = diagnosticsByClient.get(client.id) ?? emptyDiagnostic(client.id);
    return {
      client: { ...client, lastUpdatedAt: isPlaceholderDiagnostic(diagnostic) ? client.lastUpdatedAt : diagnostic.date },
      diagnostic,
      operator: operatorsById.get(client.operatorId) ?? profile,
      filesCount: filesCountByClient.get(client.id) ?? 0
    };
  });

  return bundles;
}

export async function getOperatorClientBundle(clientId: string) {
  if (!isSupabaseConfigured()) return getMockClientBundle(clientId);

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!clientRow) redirect("/operator/dashboard");

  const client = mapClient(clientRow);
  const diagnostic = (await getLatestDiagnostic(client.id)) ?? emptyDiagnostic(client.id);

  const [{ data: actionRows }, { data: fileRows }, { data: historyRows }] = await Promise.all([
    supabase.from("actions").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(CLIENT_ACTION_LIMIT),
    supabase.from("client_files").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(CLIENT_FILE_LIMIT),
    supabase.from("score_history").select("*").eq("client_id", client.id).order("date", { ascending: false }).limit(CLIENT_HISTORY_LIMIT)
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
  const { data: clientRow } = await supabase.from("clients").select("*").eq("id", clientId).single();
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

export async function getClientDashboardBundle() {
  if (!isSupabaseConfigured()) return getMockClientBundle("c-1");

  const profile = await getCurrentProfile();
  if (profile.role !== "client") redirect("/operator/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("*").eq("client_user_id", profile.id).single();
  if (!clientRow) redirect("/login");

  const bundle = await getOperatorClientBundleForClient(mapClient(clientRow));
  return bundle;
}

async function getOperatorClientBundleForClient(client: Client) {
  const supabase = await createServerSupabaseClient();
  const diagnostic = await getLatestDiagnostic(client.id);
  if (!diagnostic) redirect("/client/dashboard");

  const [{ data: actionRows }, { data: fileRows }, { data: historyRows }] = await Promise.all([
    supabase.from("actions").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(CLIENT_ACTION_LIMIT),
    supabase.from("client_files").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(CLIENT_FILE_LIMIT),
    supabase.from("score_history").select("*").eq("client_id", client.id).order("date", { ascending: false }).limit(CLIENT_HISTORY_LIMIT)
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

export async function getClientFilesBundle() {
  const bundle = await getClientDashboardBundle();
  return { client: bundle.client, files: bundle.files };
}

export async function getParsedDataPreview(clientId: string) {
  if (!isSupabaseConfigured()) {
    return {
      products: [
        { sku: "MLA-1002", stock: 24, title: "Producto demo", updatedAt: new Date().toISOString() },
        { sku: "MLA-1048", stock: 18, title: "Producto demo 2", updatedAt: new Date().toISOString() }
      ],
      margins: [
        { sku: "MLA-1002", costo: 12000, precio: 18500, margen: 35 },
        { sku: "MLA-1048", costo: 9000, precio: 14000, margen: 36 }
      ],
      specs: [
        { sku: "MLA-1002", titulo: "Producto demo", descripcion: "Ficha normalizada", attributes: {} }
      ]
    };
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const [{ data: products }, { data: margins }, { data: specs }] = await Promise.all([
    supabase.from("products").select("sku, stock, title, updated_at").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("margins").select("sku, costo, precio, margen").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("product_specs").select("sku, titulo, descripcion, attributes").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(8)
  ]);

  return {
    products: (products ?? []).map((row) => ({
      sku: row.sku,
      stock: row.stock,
      title: row.title,
      updatedAt: row.updated_at
    })),
    margins: (margins ?? []).map((row) => ({
      sku: row.sku,
      costo: row.costo,
      precio: row.precio,
      margen: row.margen
    })),
    specs: (specs ?? []).map((row) => ({
      sku: row.sku,
      titulo: row.titulo,
      descripcion: row.descripcion,
      attributes: row.attributes
    }))
  };
}

export async function getNotifications(limit = 20) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "n-demo-1",
        clientId: "c-1",
        userId: "op-1",
        tipo: "archivo_procesado",
        titulo: "Archivo procesado",
        mensaje: "stock_tienda_pampa.xlsx: 128 filas importadas como skus_stock.",
        leida: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "n-demo-2",
        clientId: "c-2",
        userId: "op-1",
        tipo: "alerta_critica",
        titulo: "Cuenta en estado crítico",
        mensaje: "Electro Norte requiere revisión de salud y logística.",
        leida: true,
        createdAt: new Date(Date.now() - 86_400_000).toISOString()
      },
      {
        id: "n-demo-3",
        clientId: "c-1",
        userId: "op-1",
        tipo: "score_bajo",
        titulo: "Caída fuerte de score",
        mensaje: "Tienda Pampa bajó 12 puntos respecto del diagnóstico anterior.",
        leida: false,
        createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString()
      },
      {
        id: "n-demo-4",
        clientId: "c-1",
        userId: "cl-1",
        tipo: "reporte_semanal",
        titulo: "Reporte semanal enviado",
        mensaje: "Te enviamos por email el resumen semanal de Tienda Pampa.",
        leida: false,
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString()
      }
    ] satisfies Notification[];
  }

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapNotification);
}

export async function getUnreadNotificationCount() {
  if (!isSupabaseConfigured()) return 1;

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("leida", false);
  return count ?? 0;
}

export async function getRecentScrapingJobs(limit = 12) {
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
    .select("*")
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

export async function getAvailableClientUsers() {
  if (!isSupabaseConfigured()) {
    return mockUsers.filter((user) => user.role === "client");
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("users").select("*").eq("role", "client").order("name");
  return (data ?? []).map(mapUser);
}

export async function getOperatorClientsList() {
  if (!isSupabaseConfigured()) return mockClients;

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("clients").select("*").eq("active", true).order("name");
  return (data ?? []).map(mapClient);
}

export async function getPricingProposalHistory(limit = 8) {
  if (!isSupabaseConfigured()) {
    return mockPricingProposals.slice(0, limit);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("pricing_proposals")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<PricingProposalRow & { clients?: { name?: string } | null }>).map((row) =>
    mapPricingProposal(row, row.clients?.name ?? "Cliente")
  );
}

function isPricingTemplateFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return (
    (normalized.endsWith(".csv") || normalized.endsWith(".xlsx")) &&
    (normalized.includes("pricing") ||
      normalized.includes("precio") ||
      normalized.includes("comercial") ||
      normalized.includes("propuesta") ||
      normalized.includes("cotizacion"))
  );
}

export async function getPricingTemplateFiles(limit = 20) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "f-pricing-demo",
        clientId: "c-1",
        clientName: "Tienda Pampa",
        filename: "pricing_comercial_tienda_pampa.xlsx",
        createdAt: new Date().toISOString()
      }
    ] satisfies PricingTemplateFile[];
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const [{ data: fileRows }, { data: clientRows }] = await Promise.all([
    supabase.from("client_files").select("id, client_id, filename, created_at").order("created_at", { ascending: false }).limit(limit * 4),
    supabase.from("clients").select("id, name")
  ]);

  const clientNames = new Map((clientRows ?? []).map((row) => [row.id, row.name]));

  return (fileRows ?? [])
    .filter((row) => isPricingTemplateFilename(row.filename))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      clientName: clientNames.get(row.client_id) ?? "Cliente",
      filename: row.filename,
      createdAt: row.created_at
    })) satisfies PricingTemplateFile[];
}

export async function getLatestMeliSession(clientId: string) {
  if (!isSupabaseConfigured()) {
    return mockMeliSessions.find((session) => session.clientId === clientId) ?? null;
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("meli_sessions")
    .select("*")
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
    .select("*")
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
