"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import type { BlockKey, Priority } from "@/lib/types";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";
import type { Database } from "@/lib/supabase/database.types";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { pickAllowedSnapshotColumns, type InternalBlockSlug, BLOCK_METRIC_COLUMNS } from "@/lib/internal/block-metrics-scope";
import { deriveAdsDerivedMetrics } from "@/lib/scoring/metric-snapshot";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeBlock(value: string): BlockKey {
  if (value === "salud" || value === "ads" || value === "logistica" || value === "stock") return value;
  return "publicaciones";
}

function normalizePriority(value: string): Priority {
  if (value === "urgente" || value === "alta") return value;
  return "media";
}

function fallbackDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

async function assertOperatorCanAccessClient(clientId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  if (!isSupabaseConfigured()) {
    return { profile, supabase: null };
  }

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).single();
  if (!client) redirect("/operator/dashboard");

  return { profile, supabase };
}

export async function createClientAction(clientId: string, formData: FormData): Promise<ActionResult<{ created: boolean }>> {
  const { profile, supabase } = await assertOperatorCanAccessClient(clientId);

  const titulo = cleanText(formData.get("titulo"));
  const descripcion = cleanText(formData.get("descripcion"));
  const bloque = normalizeBlock(cleanText(formData.get("bloque")));
  const prioridad = normalizePriority(cleanText(formData.get("prioridad")));
  const dueDate = cleanText(formData.get("due_date")) || fallbackDueDate();

  if (!titulo) {
    return { success: false, error: "El titulo de la accion es obligatorio", code: "VALIDATION_ERROR" };
  }

  if (supabase) {
    const { error } = await supabase.from("actions").insert({
      client_id: clientId,
      created_by: profile.id,
      bloque,
      titulo,
      descripcion: descripcion || null,
      prioridad,
      estado: "pendiente",
      due_date: dueDate
    });
    if (error) {
      logServerError("createClientAction", error, { clientId, operatorId: profile.id });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo crear la accion",
        code: error.code
      };
    }
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  return { success: true, data: { created: true } };
}

export async function completeClientAction(
  clientId: string,
  actionId: string
): Promise<ActionResult<{ completed: boolean }>> {
  const { supabase } = await assertOperatorCanAccessClient(clientId);

  if (supabase) {
    const { error } = await supabase
      .from("actions")
      .update({
        estado: "completada",
        completed_at: new Date().toISOString()
      })
      .eq("id", actionId)
      .eq("client_id", clientId);
    if (error) {
      logServerError("completeClientAction", error, { clientId, actionId });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo completar la accion",
        code: error.code
      };
    }
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  return { success: true, data: { completed: true } };
}

type MetricSnapshotInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];
type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];

function utcTodaySnapshotDate(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export async function markAlertResolved(alertId: string): Promise<ActionResult<void>> {
  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) {
    return { success: false, error: gate.error, code: gate.code };
  }

  const { supabase } = gate.data;

  const { data: alert, error: alertError } = await supabase.from("alerts").select("id, ml_account_id").eq("id", alertId).maybeSingle();
  if (alertError) {
    logServerError("markAlertResolved.selectAlert", alertError, { alertId });
    return {
      success: false,
      error: isPostgresError(alertError) ? formatSupabaseError(alertError) : "No se pudo actualizar la alerta",
      code: alertError.code
    };
  }
  if (!alert) {
    return { success: false, error: "Alerta no encontrada", code: "NOT_FOUND" };
  }

  const { data: account, error: accountError } = await supabase
    .from("ml_accounts")
    .select("company_id")
    .eq("id", alert.ml_account_id)
    .maybeSingle();

  if (accountError || !account) {
    logServerError("markAlertResolved.account", accountError ?? "missing_account", { alertId });
    return {
      success: false,
      error: accountError && isPostgresError(accountError) ? formatSupabaseError(accountError) : "Cuenta ML no encontrada",
      code: accountError?.code
    };
  }

  const { error: updateError } = await supabase
    .from("alerts")
    .update({
      resuelta: true,
      resuelta_at: new Date().toISOString()
    })
    .eq("id", alertId);

  if (updateError) {
    logServerError("markAlertResolved.update", updateError, { alertId });
    return {
      success: false,
      error: isPostgresError(updateError) ? formatSupabaseError(updateError) : "No se pudo marcar la alerta",
      code: updateError.code
    };
  }

  revalidatePath(`/internal/clients/${account.company_id}`);
  return { success: true, data: undefined };
}

export async function updateBlockMetrics(
  mlAccountId: string,
  block: InternalBlockSlug,
  metrics: Partial<MetricSnapshotInsert>
): Promise<ActionResult<void>> {
  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) {
    return { success: false, error: gate.error, code: gate.code };
  }

  const allowed = pickAllowedSnapshotColumns(block, metrics);
  if (Object.keys(allowed).length === 0) {
    return { success: false, error: "No hay metricas validas para guardar", code: "VALIDATION_ERROR" };
  }

  const { supabase } = gate.data;

  const { data: accountRow, error: accountError } = await supabase
    .from("ml_accounts")
    .select("id, company_id")
    .eq("id", mlAccountId)
    .maybeSingle();

  if (accountError || !accountRow) {
    return {
      success: false,
      error: accountError && isPostgresError(accountError) ? formatSupabaseError(accountError) : "Cuenta ML no encontrada",
      code: accountError?.code
    };
  }

  const snapshotDate = utcTodaySnapshotDate();

  const { data: existing, error: existingError } = await supabase
    .from("metric_snapshots")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();

  if (existingError) {
    logServerError("updateBlockMetrics.loadSnapshot", existingError, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(existingError) ? formatSupabaseError(existingError) : "No se pudo cargar el snapshot",
      code: existingError.code
    };
  }

  const base = (existing ?? {}) as Partial<MetricSnapshotRow>;
  const { created_at: _omitCreatedAt, ...snapshotRest } = base as Partial<MetricSnapshotRow> & { created_at?: string };
  void _omitCreatedAt;
  const prevSources =
    base.data_sources && typeof base.data_sources === "object" && !Array.isArray(base.data_sources)
      ? { ...(base.data_sources as Record<string, string>) }
      : {};

  prevSources[block] = "manual";

  const merged: MetricSnapshotInsert = {
    ...snapshotRest,
    ...allowed,
    ml_account_id: mlAccountId,
    snapshot_date: snapshotDate,
    source: "manual",
    data_sources: prevSources as MetricSnapshotInsert["data_sources"]
  };

  const adsFieldKeys = BLOCK_METRIC_COLUMNS.ads as readonly string[];
  const shouldDeriveAds = block === "ads" || Object.keys(allowed).some((k) => adsFieldKeys.includes(k));

  if (shouldDeriveAds) {
    const derived = deriveAdsDerivedMetrics(merged as Parameters<typeof deriveAdsDerivedMetrics>[0]);
    merged.acos = derived.acos;
    merged.roas = derived.roas;
    merged.tacos = derived.tacos;
  }

  const upsertResult = await createMetricSnapshot(merged);
  if (!upsertResult.success || !upsertResult.data) {
    return {
      success: false,
      error: upsertResult.success === false ? upsertResult.error : "No se pudo guardar el snapshot",
      code: upsertResult.success === false ? upsertResult.code : undefined
    };
  }

  const pipeline = await runRecommendationsPipelineV2({
    ml_account_id: mlAccountId,
    metric_snapshot_id: upsertResult.data.id
  });

  if (!pipeline.success) {
    return {
      success: false,
      error: pipeline.success === false ? pipeline.error : "No se pudo actualizar recomendaciones",
      code: pipeline.success === false ? pipeline.code : undefined
    };
  }

  revalidatePath(`/internal/clients/${accountRow.company_id}`);
  revalidatePath(`/internal/clients/${accountRow.company_id}/blocks/${block}`);
  return { success: true, data: undefined };
}
