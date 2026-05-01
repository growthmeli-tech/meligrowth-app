import type { Database } from "@/lib/supabase/database.types";
import type { AlertAudience, UserRoleV2 } from "@/lib/types/enums";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MLAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];
type UserV2Row = Database["public"]["Tables"]["users_v2"]["Row"];
type UserAccountAccessRow = Database["public"]["Tables"]["user_account_access"]["Row"];
type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type AccountHealthRow = Database["public"]["Tables"]["account_health"]["Row"];
type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export function createMockUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "user-operator-1",
    email: "joaquin@meligrowth.com",
    name: "Joaquin",
    role: "operator",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

export function createMockClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "client-1",
    name: "Suplementos Madero",
    initials: "SM",
    plan: "growth",
    operator_id: "user-operator-1",
    client_user_id: "user-client-1",
    meli_account_url: null,
    meli_seller_id: "123456789",
    created_at: "2026-01-01T00:00:00.000Z",
    active: true,
    ...overrides
  };
}

export function createMockDiagnostic(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return {
    id: "diag-1",
    client_id: "client-1",
    date: "2026-04-24",
    score_global: 63,
    estado_global: "En riesgo",
    reclamos: 0.6,
    mediaciones: 0.2,
    cancelaciones_vendedor: 0.3,
    envios_a_tiempo: 90,
    score_salud: 67,
    pubs_activas_pct: 64.4,
    pubs_optimizadas_pct: 70,
    ctr: 2.1,
    score_publicaciones: 81,
    margen_pre_ads: 30,
    gasto_ads: 20000,
    ventas_ads: 10000,
    ventas_totales: 30000,
    acos: 200,
    roas: 0.5,
    tacos: 66.7,
    score_ads: 15,
    incidencias_pct: 1.2,
    uso_full_flex_pct: 58,
    cancelaciones_stock_pct: 0.8,
    score_logistica: 81,
    skus_sin_stock_pct: 3.6,
    dias_stock: 38,
    lead_time_reposicion: 9,
    sistema_reposicion: 3,
    score_stock: 82,
    created_by: "user-operator-1",
    source: "manual",
    created_at: "2026-04-24T10:00:00.000Z",
    ...overrides
  };
}

export function createPlatinumDiagnostic(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return createMockDiagnostic({
    score_global: 96,
    estado_global: "Platinum",
    reclamos: 0.1,
    mediaciones: 0.02,
    cancelaciones_vendedor: 0.03,
    envios_a_tiempo: 98.5,
    score_salud: 97,
    pubs_activas_pct: 88,
    pubs_optimizadas_pct: 86,
    ctr: 3.6,
    score_publicaciones: 96,
    margen_pre_ads: 30,
    gasto_ads: 2200,
    ventas_ads: 110000,
    ventas_totales: 550000,
    acos: 2,
    roas: 50,
    tacos: 0.4,
    score_ads: 100,
    incidencias_pct: 0.2,
    uso_full_flex_pct: 82,
    cancelaciones_stock_pct: 0.1,
    score_logistica: 97,
    skus_sin_stock_pct: 0.5,
    dias_stock: 28,
    lead_time_reposicion: 2,
    sistema_reposicion: 95,
    score_stock: 97,
    ...overrides
  });
}

export function createMockCompany(overrides: Partial<CompanyRow> = {}): CompanyRow {
  return {
    id: "company-1",
    name: "Suplementos Madero",
    slug: "suplementos-madero",
    plan: "360",
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

export function createMockMLAccount(overrides: Partial<MLAccountRow> = {}): MLAccountRow {
  return {
    id: "ml-account-1",
    company_id: "company-1",
    seller_id: "123456789",
    account_name: "Cuenta MLA Principal",
    active: true,
    meli_account_url: "https://www.mercadolibre.com.ar/perfil/123456789",
    seller_reputation_level: null,
    seller_power_seller_status: null,
    seller_reputation_synced_at: null,
    default_free_shipping: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

export function createMockUserV2(role: UserRoleV2, overrides: Partial<UserV2Row> = {}): UserV2Row {
  return {
    id: "user-v2-1",
    email: "user-v2@meligrowth.com",
    name: "Usuario V2",
    role,
    company_id: "company-1",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

export function createMockUserAccountAccess(overrides: Partial<UserAccountAccessRow> = {}): UserAccountAccessRow {
  return {
    id: "uaa-1",
    user_id: "user-v2-1",
    ml_account_id: "ml-account-1",
    access_type: "operator",
    created_at: "2026-01-01T00:00:00.000Z",
    ops_access_enabled: true,
    ...overrides
  };
}

export function createMockMetricSnapshot(overrides: Partial<MetricSnapshotRow> = {}): MetricSnapshotRow {
  return {
    id: "snapshot-1",
    ml_account_id: "ml-account-1",
    snapshot_date: "2026-04-24",
    source: "manual",
    reclamos: 0.6,
    mediaciones: 0.2,
    cancelaciones_vendedor: 0.3,
    envios_a_tiempo: 90,
    pubs_activas_pct: 64.4,
    pubs_optimizadas_pct: 70,
    ctr: 2.1,
    margen_pre_ads: 30,
    gasto_ads: 20000,
    ventas_ads: 10000,
    ventas_totales: 30000,
    acos: 200,
    roas: 0.5,
    tacos: 66.7,
    incidencias_pct: 1.2,
    uso_full_flex_pct: 58,
    cancelaciones_stock_pct: 0.8,
    skus_sin_stock_pct: 3.6,
    dias_stock: 38,
    lead_time_reposicion: 9,
    sistema_reposicion: 50,
    data_sources: {
      salud: "api",
      publicaciones: "api",
      ads: "manual",
      logistica: "api",
      stock: "manual"
    },
    created_at: "2026-04-24T10:00:00.000Z",
    nivel_vendedor: null,
    ventas_completadas_60d: null,
    periodo_reputacion: null,
    listings_quota: null,
    listings_total_items: null,
    reputacion_protegida: null,
    reputacion_real_level: null,
    reputacion_level_id: null,
    ...overrides
  };
}

export function createMockAccountHealth(overrides: Partial<AccountHealthRow> = {}): AccountHealthRow {
  return {
    id: "health-1",
    ml_account_id: "ml-account-1",
    snapshot_id: "snapshot-1",
    snapshot_date: "2026-04-24",
    score_global: 63,
    estado_global: "en_riesgo",
    score_salud: 67,
    score_publicaciones: 81,
    score_ads: 15,
    score_logistica: 81,
    score_stock: 82,
    created_at: "2026-04-24T10:05:00.000Z",
    ...overrides
  };
}

export function createMockAlert(audiencia: AlertAudience, overrides: Partial<AlertRow> = {}): AlertRow {
  return {
    id: "alert-1",
    ml_account_id: "ml-account-1",
    health_id: "health-1",
    categoria: "salud",
    prioridad: "urgente",
    titulo: "Cuenta en riesgo operativo",
    descripcion: "Hay indicadores criticos que requieren accion hoy.",
    accion_concreta: "Priorizar correcciones en bloque salud y ads.",
    benchmark_objetivo: "Volver a score >= 70",
    audiencia,
    steps: [],
    resuelta: false,
    resuelta_at: null,
    created_at: "2026-04-24T10:10:00.000Z",
    ...overrides
  };
}
