import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { AlertAudience } from "@/lib/types/enums";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type AlertInsert = Database["public"]["Tables"]["alerts"]["Insert"];

const ALERT_SELECT =
  "id, ml_account_id, health_id, categoria, prioridad, titulo, descripcion, accion_concreta, benchmark_objetivo, audiencia, resuelta, resuelta_at, created_at";

export async function listAlertsByAccount(
  mlAccountId: string,
  options?: { audience?: AlertAudience; includeResolved?: boolean; limit?: number }
): Promise<ActionResult<AlertRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("created_at", { ascending: false });

  if (!options?.includeResolved) {
    query = query.eq("resuelta", false);
  }
  if (options?.audience) {
    if (options.audience === "operator" || options.audience === "manager" || options.audience === "internal") {
      query = query.in("audiencia", [options.audience, "all"]);
    } else {
      query = query.eq("audiencia", options.audience);
    }
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listAlertsByAccount", error, { mlAccountId, ...options });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

export async function listUrgentPendingAlertsByAccounts(accountIds: string[]): Promise<ActionResult<AlertRow[]>> {
  if (accountIds.length === 0) return { success: true, data: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .in("ml_account_id", accountIds)
    .eq("resuelta", false)
    .eq("prioridad", "urgente")
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listUrgentPendingAlertsByAccounts", error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas urgentes",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

/** Inicio del día actual en UTC (00:00:00.000Z). */
export function utcStartOfTodayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

/**
 * Alertas sin resolver creadas desde medianoche UTC de hoy (anti-duplicado por sync el mismo día).
 */
export async function countUnresolvedAlertsForAccountSinceUtcStartOfDay(
  mlAccountId: string
): Promise<ActionResult<number>> {
  const supabase = await createServerSupabaseClient();
  const start = utcStartOfTodayIso();
  const { count, error } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("ml_account_id", mlAccountId)
    .eq("resuelta", false)
    .gte("created_at", start);

  if (error) {
    logServerError("data-v2.countUnresolvedAlertsForAccountSinceUtcStartOfDay", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron verificar alertas",
      code: error.code
    };
  }

  return { success: true, data: count ?? 0 };
}

export async function listUnresolvedAlertsForAccountSinceUtcStartOfDay(
  mlAccountId: string
): Promise<ActionResult<AlertRow[]>> {
  const supabase = await createServerSupabaseClient();
  const start = utcStartOfTodayIso();
  const { data, error } = await supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("ml_account_id", mlAccountId)
    .eq("resuelta", false)
    .gte("created_at", start)
    .order("created_at", { ascending: true });

  if (error) {
    logServerError("data-v2.listUnresolvedAlertsForAccountSinceUtcStartOfDay", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

/** Alertas ya vinculadas a un registro de account_health (evita duplicar al re-ejecutar persist). */
export async function listAlertsByHealthId(
  healthId: string,
  options?: { mlAccountId?: string }
): Promise<ActionResult<AlertRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("alerts")
    .select(ALERT_SELECT)
    .eq("health_id", healthId)
    .order("created_at", { ascending: true });

  if (options?.mlAccountId) {
    query = query.eq("ml_account_id", options.mlAccountId);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listAlertsByHealthId", error, { healthId, mlAccountId: options?.mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron cargar alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

export async function createAlertsBulk(payload: AlertInsert[]): Promise<ActionResult<AlertRow[]>> {
  if (payload.length === 0) {
    return { success: true, data: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("alerts").insert(payload).select(ALERT_SELECT);

  if (error) {
    logServerError("data-v2.createAlertsBulk", error, { count: payload.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron crear alertas",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AlertRow[] };
}

export type InternalAlertItem = AlertRow & {
  company_id: string;
  company_name: string;
};

export async function listInternalAlerts(options?: {
  priority?: AlertRow["prioridad"] | "all";
  companyId?: string | "all";
  resolution?: "pendiente" | "resuelta" | "all";
}): Promise<ActionResult<InternalAlertItem[]>> {
  const supabase = await createServerSupabaseClient();
  let alertsQuery = supabase.from("alerts").select(ALERT_SELECT).order("created_at", { ascending: false });

  if (options?.priority && options.priority !== "all") {
    alertsQuery = alertsQuery.eq("prioridad", options.priority);
  }

  if (options?.resolution === "pendiente") {
    alertsQuery = alertsQuery.eq("resuelta", false);
  } else if (options?.resolution === "resuelta") {
    alertsQuery = alertsQuery.eq("resuelta", true);
  }

  const { data: alertsData, error: alertsError } = await alertsQuery;
  if (alertsError) {
    logServerError("data-v2.listInternalAlerts.alerts", alertsError, options);
    return {
      success: false,
      error: isPostgresError(alertsError) ? formatSupabaseError(alertsError) : "No se pudieron cargar alertas",
      code: alertsError.code
    };
  }

  const alerts = (alertsData ?? []) as AlertRow[];
  if (alerts.length === 0) return { success: true, data: [] };

  const accountIds = Array.from(new Set(alerts.map((alert) => alert.ml_account_id)));
  const { data: accountsData, error: accountsError } = await supabase
    .from("ml_accounts")
    .select("id, company_id")
    .in("id", accountIds);

  if (accountsError) {
    logServerError("data-v2.listInternalAlerts.accounts", accountsError, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(accountsError) ? formatSupabaseError(accountsError) : "No se pudieron cargar cuentas ML",
      code: accountsError.code
    };
  }

  const accountToCompany = new Map<string, string>();
  for (const row of (accountsData ?? []) as Array<{ id: string; company_id: string }>) {
    accountToCompany.set(row.id, row.company_id);
  }

  const companyIds = Array.from(new Set(Array.from(accountToCompany.values())));
  const { data: companiesData, error: companiesError } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", companyIds);

  if (companiesError) {
    logServerError("data-v2.listInternalAlerts.companies", companiesError, { companyIdsCount: companyIds.length });
    return {
      success: false,
      error: isPostgresError(companiesError) ? formatSupabaseError(companiesError) : "No se pudieron cargar companies",
      code: companiesError.code
    };
  }

  const companyNameById = new Map<string, string>();
  for (const row of (companiesData ?? []) as Array<{ id: string; name: string }>) {
    companyNameById.set(row.id, row.name);
  }

  const withCompany = alerts
    .map<InternalAlertItem | null>((alert) => {
      const companyId = accountToCompany.get(alert.ml_account_id);
      if (!companyId) return null;
      return {
        ...alert,
        company_id: companyId,
        company_name: companyNameById.get(companyId) ?? "Company sin nombre"
      };
    })
    .filter((item): item is InternalAlertItem => item !== null);

  const filteredByCompany =
    options?.companyId && options.companyId !== "all"
      ? withCompany.filter((alert) => alert.company_id === options.companyId)
      : withCompany;

  const priorityOrder: Record<AlertRow["prioridad"], number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baja: 3
  };

  filteredByCompany.sort((a, b) => {
    const byPriority = priorityOrder[a.prioridad] - priorityOrder[b.prioridad];
    if (byPriority !== 0) return byPriority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { success: true, data: filteredByCompany };
}
