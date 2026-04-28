import { enrichRecommendationsWithClaude, type EnrichedRecommendation } from "@/lib/recommendations/ai-enricher";
import { generateRecommendations, type RecommendationsDiagnosticInput } from "@/lib/recommendations/engine";
import { persistRecommendationsAsAlerts } from "@/lib/recommendations/persist";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import { scoreDiagnostic } from "@/lib/scoring";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { DiagnosticInput } from "@/lib/types/domain";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

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

  const scoringInput = snapshotToDiagnosticInput(snapshot);
  const scored = scoreDiagnostic(scoringInput, { hasAdsData: hasAdsSnapshotData(snapshot) });
  const estadoGlobal = getEstadoGlobalLabel(scored.scoreGlobal);

  const { data: accountHealth, error: healthError } = await supabase
    .from("account_health")
    .insert({
      ml_account_id: input.ml_account_id,
      snapshot_id: snapshot.id,
      snapshot_date: snapshot.snapshot_date,
      score_global: scored.scoreGlobal,
      estado_global: estadoGlobal,
      score_salud: scored.scores.salud,
      score_publicaciones: scored.scores.publicaciones,
      score_ads: scored.scores.ads,
      score_logistica: scored.scores.logistica,
      score_stock: scored.scores.stock
    })
    .select("*")
    .single();

  if (healthError || !accountHealth) {
    logServerError("recommendations.pipeline-v2.account-health", healthError ?? "health_not_created", input);
    return {
      success: false,
      error: healthError && isPostgresError(healthError) ? formatSupabaseError(healthError) : "No se pudo persistir account_health",
      code: healthError?.code
    };
  }

  // Cache: evitar llamadas duplicadas a Claude en el mismo día
  const today = new Date().toISOString().slice(0, 10);

  const { count: existingAlertsCount } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("ml_account_id", input.ml_account_id)
    .eq("resuelta", false)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .not("steps", "eq", "[]");

  const shouldEnrich = (existingAlertsCount ?? 0) === 0;

  const recommendationsInput = snapshotToRecommendationsInput(snapshot, accountHealth);
  const baseRecommendations = generateRecommendations(recommendationsInput);

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

function snapshotToDiagnosticInput(snapshot: MetricSnapshotRow): DiagnosticInput {
  const adsMetrics = deriveAdsMetrics(snapshot);

  return {
    salud: {
      reclamos: asNumber(snapshot.reclamos),
      mediaciones: asNumber(snapshot.mediaciones),
      cancelaciones_vendedor: asNumber(snapshot.cancelaciones_vendedor),
      envios_a_tiempo: asNumber(snapshot.envios_a_tiempo)
    },
    publicaciones: {
      pubs_activas_pct: asNumber(snapshot.pubs_activas_pct),
      pubs_optimizadas_pct: asNumber(snapshot.pubs_optimizadas_pct),
      ctr: asNumber(snapshot.ctr)
    },
    ads: {
      margen_pre_ads: asNumber(snapshot.margen_pre_ads),
      gasto_ads: asNumber(snapshot.gasto_ads),
      ventas_ads: asNumber(snapshot.ventas_ads),
      ventas_totales: asNumber(snapshot.ventas_totales),
      acos: adsMetrics.acos,
      roas: adsMetrics.roas,
      tacos: adsMetrics.tacos
    },
    logistica: {
      incidencias_pct: asNumber(snapshot.incidencias_pct),
      uso_full_flex_pct: asNumber(snapshot.uso_full_flex_pct),
      cancelaciones_stock_pct: asNumber(snapshot.cancelaciones_stock_pct)
    },
    stock: {
      skus_sin_stock_pct: asNumber(snapshot.skus_sin_stock_pct),
      dias_stock: asNumber(snapshot.dias_stock),
      lead_time_reposicion: asNumber(snapshot.lead_time_reposicion),
      // Neutral baseline when the client has not completed this manual field yet.
      sistema_reposicion: snapshot.sistema_reposicion ?? 50
    }
  };
}

function snapshotToRecommendationsInput(
  snapshot: MetricSnapshotRow,
  accountHealth: AccountHealthRow
): RecommendationsDiagnosticInput {
  const adsMetrics = deriveAdsMetrics(snapshot);

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
    acos: snapshot.acos ?? adsMetrics.acos,
    roas: snapshot.roas ?? adsMetrics.roas,
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

function asNumber(value: number | null): number {
  return typeof value === "number" ? value : 0;
}

function deriveAdsMetrics(snapshot: MetricSnapshotRow): { acos: number; roas: number; tacos: number } {
  const gastoAds = asNumber(snapshot.gasto_ads);
  const ventasAds = asNumber(snapshot.ventas_ads);
  const ventasTotales = asNumber(snapshot.ventas_totales);

  return {
    acos: snapshot.acos ?? (ventasAds > 0 ? (gastoAds / ventasAds) * 100 : 0),
    roas: snapshot.roas ?? (gastoAds > 0 ? ventasAds / gastoAds : 0),
    tacos: snapshot.tacos ?? (ventasTotales > 0 ? (gastoAds / ventasTotales) * 100 : 0)
  };
}

function hasAdsSnapshotData(snapshot: MetricSnapshotRow): boolean {
  return snapshot.gasto_ads !== null && snapshot.ventas_ads !== null && snapshot.ventas_totales !== null;
}

function getEstadoGlobalLabel(score: number) {
  if (score >= 95) return "platinum";
  if (score >= 85) return "muy_bueno";
  if (score >= 70) return "solido";
  if (score >= 55) return "en_desarrollo";
  if (score >= 40) return "en_riesgo";
  return "critico";
}
