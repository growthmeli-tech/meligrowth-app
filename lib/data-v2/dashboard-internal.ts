import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MlAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];
type AccountHealthRow = Database["public"]["Tables"]["account_health"]["Row"];
type AlertRow = Pick<Database["public"]["Tables"]["alerts"]["Row"], "id" | "ml_account_id">;
type TaskRow = Pick<Database["public"]["Tables"]["tasks"]["Row"], "id" | "ml_account_id">;

export type InternalDashboardCompany = {
  company: CompanyRow;
  mlAccount: MlAccountRow | null;
  latestHealth: AccountHealthRow | null;
  urgentAlertsPending: number;
  tasksPending: number;
};

const COMPANY_SELECT = "id, name, slug, plan, active, created_at, updated_at";
const ACCOUNT_SELECT = "id, company_id, seller_id, account_name, active, meli_account_url, created_at, updated_at";
const HEALTH_SELECT =
  "id, ml_account_id, snapshot_id, snapshot_date, score_global, estado_global, score_salud, score_publicaciones, score_ads, score_logistica, score_stock, created_at";

export async function getInternalDashboardCompanies(): Promise<ActionResult<InternalDashboardCompany[]>> {
  const supabase = await createServerSupabaseClient();

  const { data: companyRows, error: companyError } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .eq("active", true)
    .order("name");

  if (companyError) {
    logServerError("data-v2.getInternalDashboardCompanies.companies", companyError);
    return {
      success: false,
      error: isPostgresError(companyError) ? formatSupabaseError(companyError) : "No se pudieron cargar companies",
      code: companyError.code
    };
  }

  const companies = (companyRows ?? []) as CompanyRow[];
  if (companies.length === 0) {
    return { success: true, data: [] };
  }

  const companyIds = companies.map((company) => company.id);
  const { data: accountRows, error: accountError } = await supabase
    .from("ml_accounts")
    .select(ACCOUNT_SELECT)
    .in("company_id", companyIds)
    .eq("active", true)
    .order("company_id")
    .order("created_at", { ascending: false });

  if (accountError) {
    logServerError("data-v2.getInternalDashboardCompanies.accounts", accountError, { companyIdsCount: companyIds.length });
    return {
      success: false,
      error: isPostgresError(accountError) ? formatSupabaseError(accountError) : "No se pudieron cargar cuentas ML",
      code: accountError.code
    };
  }

  const accountByCompany = new Map<string, MlAccountRow>();
  for (const row of (accountRows ?? []) as MlAccountRow[]) {
    if (!accountByCompany.has(row.company_id)) {
      accountByCompany.set(row.company_id, row);
    }
  }

  const accountIds = Array.from(accountByCompany.values()).map((account) => account.id);
  if (accountIds.length === 0) {
    return {
      success: true,
      data: companies.map((company) => ({
        company,
        mlAccount: null,
        latestHealth: null,
        urgentAlertsPending: 0,
        tasksPending: 0
      }))
    };
  }

  const [healthResult, alertsResult, tasksResult] = await Promise.all([
    supabase
      .from("account_health")
      .select(HEALTH_SELECT)
      .in("ml_account_id", accountIds)
      .order("ml_account_id")
      .order("snapshot_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("id, ml_account_id")
      .in("ml_account_id", accountIds)
      .eq("resuelta", false)
      .eq("prioridad", "urgente"),
    supabase
      .from("tasks")
      .select("id, ml_account_id")
      .in("ml_account_id", accountIds)
      .in("estado", ["pendiente", "en_curso"])
  ]);

  if (healthResult.error) {
    logServerError("data-v2.getInternalDashboardCompanies.health", healthResult.error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(healthResult.error) ? formatSupabaseError(healthResult.error) : "No se pudo cargar account_health",
      code: healthResult.error.code
    };
  }

  if (alertsResult.error) {
    logServerError("data-v2.getInternalDashboardCompanies.alerts", alertsResult.error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(alertsResult.error) ? formatSupabaseError(alertsResult.error) : "No se pudieron cargar alertas urgentes",
      code: alertsResult.error.code
    };
  }

  if (tasksResult.error) {
    logServerError("data-v2.getInternalDashboardCompanies.tasks", tasksResult.error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(tasksResult.error) ? formatSupabaseError(tasksResult.error) : "No se pudieron cargar tareas pendientes",
      code: tasksResult.error.code
    };
  }

  const healthByAccount = new Map<string, AccountHealthRow>();
  for (const row of (healthResult.data ?? []) as AccountHealthRow[]) {
    if (!healthByAccount.has(row.ml_account_id)) {
      healthByAccount.set(row.ml_account_id, row);
    }
  }

  const urgentAlertsByAccount = new Map<string, number>();
  for (const row of (alertsResult.data ?? []) as AlertRow[]) {
    urgentAlertsByAccount.set(row.ml_account_id, (urgentAlertsByAccount.get(row.ml_account_id) ?? 0) + 1);
  }

  const pendingTasksByAccount = new Map<string, number>();
  for (const row of (tasksResult.data ?? []) as TaskRow[]) {
    pendingTasksByAccount.set(row.ml_account_id, (pendingTasksByAccount.get(row.ml_account_id) ?? 0) + 1);
  }

  return {
    success: true,
    data: companies.map((company) => {
      const mlAccount = accountByCompany.get(company.id) ?? null;
      const accountId = mlAccount?.id;

      return {
        company,
        mlAccount,
        latestHealth: accountId ? healthByAccount.get(accountId) ?? null : null,
        urgentAlertsPending: accountId ? urgentAlertsByAccount.get(accountId) ?? 0 : 0,
        tasksPending: accountId ? pendingTasksByAccount.get(accountId) ?? 0 : 0
      };
    })
  };
}
