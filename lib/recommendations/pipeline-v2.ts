import { hasMeaningfulAdsActivity } from "@/lib/ops/meaningful-ads";
import { enrichRecommendationsWithClaude, type EnrichedRecommendation } from "@/lib/recommendations/ai-enricher";
import { generateRecommendations, type RecommendationsDiagnosticInput } from "@/lib/recommendations/engine";
import { persistRecommendationsAsAlerts } from "@/lib/recommendations/persist";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import { deriveAdsDerivedMetrics, scoreDiagnosticFromMetricSnapshot } from "@/lib/scoring";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";
import { utcStartOfTodayIso } from "@/lib/data-v2/alerts";

type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type AccountHealthRow = Database["public"]["Tables"]["account_health"]["Row"];

type PipelineV2Output = {
  account_health: AccountHealthRow;
  recommendations: DiagnosticRecommendations;
  persisted_alerts_count: number;
};

export async function runRecommendationsPipelineV2(input: {
  ml_account_id: string;
  metric_snapshot_id: string;
}): Promise<ActionResult<PipelineV2Output>> {
  const supabase = await createServerSupabaseClient();

  const { data: snapshot, error: snapshotError } = await supabase
    .from("metric_snapshots")
    .select("*")
    .eq("id", input.metric_snapshot_id)
    .eq("ml_account_id", input.ml_account_id)
    .maybeSingle();

  if (snapshotError || !snapshot) {
    logServerError("recommendations.pipeline-v2.snapshot", snapshotError ?? "snapshot_not_found", input);
    return {
      success: false,
      error:
        snapshotError && isPostgresError(snapshotError)
          ? formatSupabaseError(snapshotError)
          : "No se encontro metric_snapshot para la cuenta indicada",
      code: snapshotError?.code
    };
  }

  const meaningfulAds = hasMeaningfulAdsActivity(snapshot);
  const scored = scoreDiagnosticFromMetricSnapshot(snapshot, { hasAdsData: hasAdsSnapshotData(snapshot) });
  const estadoGlobal = getEstadoGlobalLabel(scored.scoreGlobal);

  const healthInsertPayload = {
    ml_account_id: input.ml_account_id,
    snapshot_id: snapshot.id,
    snapshot_date: snapshot.snapshot_date,
    score_global: scored.scoreGlobal,
    estado_global: estadoGlobal,
    score_salud: scored.scores.salud,
    score_publicaciones: scored.scores.publicaciones,
    score_ads: meaningfulAds ? scored.scores.ads : null,
    score_logistica: scored.scores.logistica,
    score_stock: scored.scores.stock
  };

  const { data: existingHealth } = await supabase
    .from("account_health")
    .select("*")
    .eq("ml_account_id", input.ml_account_id)
    .eq("snapshot_date", snapshot.snapshot_date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let accountHealth: AccountHealthRow;

  if (existingHealth) {
    const { data: updatedHealth, error: updateError } = await supabase
      .from("account_health")
      .update({
        snapshot_id: healthInsertPayload.snapshot_id,
        score_global: healthInsertPayload.score_global,
        estado_global: healthInsertPayload.estado_global,
        score_salud: healthInsertPayload.score_salud,
        score_publicaciones: healthInsertPayload.score_publicaciones,
        score_ads: healthInsertPayload.score_ads,
        score_logistica: healthInsertPayload.score_logistica,
        score_stock: healthInsertPayload.score_stock
      })
      .eq("id", existingHealth.id)
      .select("*")
      .single();

    if (updateError || !updatedHealth) {
      logServerError("recommendations.pipeline-v2.account-health-update", updateError ?? "health_not_updated", input);
      return {
        success: false,
        error:
          updateError && isPostgresError(updateError) ? formatSupabaseError(updateError) : "No se pudo actualizar account_health",
        code: updateError?.code
      };
    }
    accountHealth = updatedHealth as AccountHealthRow;
  } else {
    const { data: insertedHealth, error: healthError } = await supabase
      .from("account_health")
      .insert(healthInsertPayload)
      .select("*")
      .single();

    if (healthError || !insertedHealth) {
      logServerError("recommendations.pipeline-v2.account-health", healthError ?? "health_not_created", input);
      return {
        success: false,
        error: healthError && isPostgresError(healthError) ? formatSupabaseError(healthError) : "No se pudo persistir account_health",
        code: healthError?.code
      };
    }
    accountHealth = insertedHealth as AccountHealthRow;
  }

  // Cache: evitar llamadas duplicadas a Claude en el mismo día
  const todayStartUtc = utcStartOfTodayIso();

  const { count: existingAlertsCount } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("ml_account_id", input.ml_account_id)
    .eq("resuelta", false)
    .gte("created_at", todayStartUtc)
    .not("steps", "eq", "[]");

  const shouldEnrich = (existingAlertsCount ?? 0) === 0;

  const recommendationsInput = snapshotToRecommendationsInput(snapshot, accountHealth);
  const dataSources = ((snapshot.data_sources as Record<string, string> | null) ?? {}) as Record<string, string>;
  const baseRecommendations = generateRecommendations(recommendationsInput, {
    data_sources: dataSources,
    ml_snapshot: {
      nivel_vendedor: snapshot.nivel_vendedor,
      ventas_completadas_60d: snapshot.ventas_completadas_60d,
      periodo_reputacion: snapshot.periodo_reputacion,
      reputacion_real_level: snapshot.reputacion_real_level,
      reputacion_level_id: snapshot.reputacion_level_id,
      listings_quota: snapshot.listings_quota,
      listings_total_items: snapshot.listings_total_items,
      uso_full_flex_pct: snapshot.uso_full_flex_pct,
      acos: snapshot.acos,
      roas: snapshot.roas,
      margen_pre_ads: snapshot.margen_pre_ads,
      dias_stock: snapshot.dias_stock,
      skus_sin_stock_pct: snapshot.skus_sin_stock_pct,
      ventas_totales: snapshot.ventas_totales,
      gasto_ads: snapshot.gasto_ads,
      ventas_ads: snapshot.ventas_ads
    }
  });

  const enrichedRecs: EnrichedRecommendation[] = shouldEnrich
    ? await enrichRecommendationsWithClaude(baseRecommendations.recomendaciones, snapshot)
    : baseRecommendations.recomendaciones.map((r) => ({ ...r, steps: [] }));

  const recommendations = {
    ...baseRecommendations,
    recomendaciones: enrichedRecs
  };

  const persistResult = await persistRecommendationsAsAlerts({
    ml_account_id: input.ml_account_id,
    health_id: accountHealth.id,
    recommendations
  });

  if (!persistResult.success) {
    return persistResult;
  }

  return {
    success: true,
    data: {
      account_health: accountHealth as AccountHealthRow,
      recommendations,
      persisted_alerts_count: persistResult.data.persisted_count
    }
  };
}

function snapshotToRecommendationsInput(
  snapshot: MetricSnapshotRow,
  accountHealth: AccountHealthRow
): RecommendationsDiagnosticInput {
  const adsMetrics = deriveAdsDerivedMetrics(snapshot);
  const meaningful = hasMeaningfulAdsActivity(snapshot);

  return {
    id: accountHealth.id,
    client_id: snapshot.ml_account_id,
    score_global: accountHealth.score_global,
    reclamos: snapshot.reclamos,
    mediaciones: snapshot.mediaciones,
    cancelaciones_vendedor: snapshot.cancelaciones_vendedor,
    envios_a_tiempo: snapshot.envios_a_tiempo,
    pubs_activas_pct: snapshot.pubs_activas_pct,
    pubs_optimizadas_pct: snapshot.pubs_optimizadas_pct,
    ctr: snapshot.ctr,
    acos: meaningful ? (snapshot.acos ?? adsMetrics.acos) : null,
    roas: meaningful ? (snapshot.roas ?? adsMetrics.roas) : null,
    incidencias_pct: snapshot.incidencias_pct,
    uso_full_flex_pct: snapshot.uso_full_flex_pct,
    cancelaciones_stock_pct: snapshot.cancelaciones_stock_pct,
    skus_sin_stock_pct: snapshot.skus_sin_stock_pct,
    dias_stock: snapshot.dias_stock,
    lead_time_reposicion: snapshot.lead_time_reposicion,
    margen_pre_ads: snapshot.margen_pre_ads,
    gasto_ads: snapshot.gasto_ads,
    ventas_ads: snapshot.ventas_ads,
    ventas_totales: snapshot.ventas_totales,
    score_salud: accountHealth.score_salud,
    score_publicaciones: accountHealth.score_publicaciones,
    score_ads: accountHealth.score_ads,
    score_logistica: accountHealth.score_logistica,
    score_stock: accountHealth.score_stock
  };
}

/** Pesos globales: solo si hay actividad medible en Ads y base para TACOS */
function hasAdsSnapshotData(snapshot: MetricSnapshotRow): boolean {
  return (
    hasMeaningfulAdsActivity(snapshot) &&
    snapshot.ventas_totales !== null &&
    snapshot.ventas_totales !== undefined
  );
}

function getEstadoGlobalLabel(score: number) {
  if (score >= 95) return "platinum";
  if (score >= 85) return "muy_bueno";
  if (score >= 70) return "solido";
  if (score >= 55) return "en_desarrollo";
  if (score >= 40) return "en_riesgo";
  return "critico";
}
