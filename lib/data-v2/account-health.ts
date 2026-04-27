import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type AccountHealthRow = Database["public"]["Tables"]["account_health"]["Row"];

const ACCOUNT_HEALTH_SELECT =
  "id, ml_account_id, snapshot_id, snapshot_date, score_global, estado_global, score_salud, score_publicaciones, score_ads, score_logistica, score_stock, created_at";

export async function listAccountHealthByAccount(
  mlAccountId: string,
  limit = 30
): Promise<ActionResult<AccountHealthRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("account_health")
    .select(ACCOUNT_HEALTH_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logServerError("data-v2.listAccountHealthByAccount", error, { mlAccountId, limit });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar account_health",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as AccountHealthRow[] };
}

export async function getLatestAccountHealthByAccount(mlAccountId: string): Promise<ActionResult<AccountHealthRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("account_health")
    .select(ACCOUNT_HEALTH_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logServerError("data-v2.getLatestAccountHealthByAccount", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar el estado mas reciente",
      code: error.code
    };
  }

  return { success: true, data: (data as AccountHealthRow | null) ?? null };
}

export async function getAccountHealthWithDelta(
  mlAccountId: string
): Promise<ActionResult<{ current: AccountHealthRow; delta: number | null }>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("account_health")
    .select(ACCOUNT_HEALTH_SELECT)
    .eq("ml_account_id", mlAccountId)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2);

  if (error || !data || data.length === 0) {
    logServerError("data-v2.getAccountHealthWithDelta", error ?? "missing_health", { mlAccountId });
    return {
      success: false,
      error: error && isPostgresError(error) ? formatSupabaseError(error) : "No hay account_health para esta cuenta",
      code: error?.code
    };
  }

  const [current, previous] = data as AccountHealthRow[];
  const delta = previous ? Number(current.score_global ?? 0) - Number(previous.score_global ?? 0) : null;

  return {
    success: true,
    data: {
      current,
      delta
    }
  };
}

export async function getDiagnosticWithDelta(
  mlAccountId: string
): Promise<ActionResult<{ current: AccountHealthRow; delta: number | null }>> {
  return getAccountHealthWithDelta(mlAccountId);
}

export async function listLatestAccountHealthForAccounts(accountIds: string[]): Promise<ActionResult<AccountHealthRow[]>> {
  if (accountIds.length === 0) return { success: true, data: [] };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("account_health")
    .select(ACCOUNT_HEALTH_SELECT)
    .in("ml_account_id", accountIds)
    .order("ml_account_id")
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("data-v2.listLatestAccountHealthForAccounts", error, { accountIdsCount: accountIds.length });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar account_health para cuentas",
      code: error.code
    };
  }

  const latestByAccount = new Map<string, AccountHealthRow>();
  for (const row of (data ?? []) as AccountHealthRow[]) {
    if (!latestByAccount.has(row.ml_account_id)) {
      latestByAccount.set(row.ml_account_id, row);
    }
  }

  return { success: true, data: Array.from(latestByAccount.values()) };
}
