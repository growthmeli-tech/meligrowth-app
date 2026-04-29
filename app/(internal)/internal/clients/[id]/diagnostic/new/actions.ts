"use server";

import { revalidatePath } from "next/cache";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import type { DiagnosticReportData } from "@/lib/reports/generate-diagnostic-report";
import { parseManualNumericInput } from "@/lib/scoring/metric-semantics";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";

function numberFromForm(formData: FormData, key: string) {
  return parseManualNumericInput(formData.get(key));
}

export async function createDiagnostic(
  companyId: string,
  mlAccountId: string,
  formData: FormData
): Promise<
  ActionResult<{
    diagnostic: { id: string; score_global: number; estado_global: string };
    recommendations: DiagnosticRecommendations;
    reportData: DiagnosticReportData;
  }>
> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase no esta configurado" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autorizado" };
  }

  const date = String(formData.get("date") || new Date().toISOString().slice(0, 10));
  const sourceInput = String(formData.get("source") || "manual");
  const source: "api" | "scraper" | "manual" | "csv" =
    sourceInput === "scraping" ? "scraper" : sourceInput === "import" ? "csv" : "manual";
  const hasAutomatedSource = source === "scraper";
  const dataSources = {
    salud: hasAutomatedSource ? source : "manual",
    publicaciones: hasAutomatedSource ? source : "manual",
    ads: hasAutomatedSource ? source : "manual",
    logistica: hasAutomatedSource ? source : "manual",
    stock: hasAutomatedSource ? source : "manual"
  } as const;

  const snapshotResult = await createMetricSnapshot({
    ml_account_id: mlAccountId,
    snapshot_date: date,
    source,
    reclamos: numberFromForm(formData, "reclamos"),
    mediaciones: numberFromForm(formData, "mediaciones"),
    cancelaciones_vendedor: numberFromForm(formData, "cancelaciones_vendedor"),
    envios_a_tiempo: numberFromForm(formData, "envios_a_tiempo"),
    pubs_activas_pct: numberFromForm(formData, "pubs_activas_pct"),
    pubs_optimizadas_pct: numberFromForm(formData, "pubs_optimizadas_pct"),
    ctr: numberFromForm(formData, "ctr"),
    margen_pre_ads: numberFromForm(formData, "margen_pre_ads"),
    gasto_ads: numberFromForm(formData, "gasto_ads"),
    ventas_ads: numberFromForm(formData, "ventas_ads"),
    ventas_totales: numberFromForm(formData, "ventas_totales"),
    acos: numberFromForm(formData, "acos"),
    roas: numberFromForm(formData, "roas"),
    tacos: numberFromForm(formData, "tacos"),
    incidencias_pct: numberFromForm(formData, "incidencias_pct"),
    uso_full_flex_pct: numberFromForm(formData, "uso_full_flex_pct"),
    cancelaciones_stock_pct: numberFromForm(formData, "cancelaciones_stock_pct"),
    skus_sin_stock_pct: numberFromForm(formData, "skus_sin_stock_pct"),
    dias_stock: numberFromForm(formData, "dias_stock"),
    lead_time_reposicion: numberFromForm(formData, "lead_time_reposicion"),
    sistema_reposicion: numberFromForm(formData, "sistema_reposicion"),
    data_sources: dataSources
  });

  if (!snapshotResult.success) {
    return { success: false, error: snapshotResult.error };
  }

  const pipelineResult = await runRecommendationsPipelineV2({
    ml_account_id: mlAccountId,
    metric_snapshot_id: snapshotResult.data.id
  });

  if (!pipelineResult.success) {
    return { success: false, error: pipelineResult.error };
  }

  revalidatePath(`/internal/clients/${companyId}`);
  revalidatePath(`/internal/clients/${companyId}/diagnostic/new`);

  const { data: company } = await supabase.from("companies").select("name, plan").eq("id", companyId).maybeSingle();
  const topRecommendations = pipelineResult.data.recommendations.recomendaciones.slice(0, 3);

  const reportData: DiagnosticReportData = {
    company_name: company?.name ?? "Company",
    plan: company?.plan ?? "360",
    fecha: date,
    score_global: Number(pipelineResult.data.account_health.score_global ?? 0),
    estado_global: String(pipelineResult.data.account_health.estado_global ?? "critico"),
    score_salud: Number(pipelineResult.data.account_health.score_salud ?? 0),
    score_publicaciones: Number(pipelineResult.data.account_health.score_publicaciones ?? 0),
    score_ads: pipelineResult.data.account_health.score_ads != null ? Number(pipelineResult.data.account_health.score_ads) : null,
    score_logistica: Number(pipelineResult.data.account_health.score_logistica ?? 0),
    score_stock: Number(pipelineResult.data.account_health.score_stock ?? 0),
    alertas: topRecommendations.map((recommendation) => ({
      titulo: recommendation.titulo,
      descripcion: recommendation.descripcion,
      accion_concreta: recommendation.accion_concreta,
      prioridad: recommendation.prioridad,
      categoria: recommendation.categoria
    })),
    recomendaciones_top3: topRecommendations.map((recommendation) => ({
      titulo: recommendation.titulo,
      accion_concreta: recommendation.accion_concreta,
      impacto_estimado: recommendation.impacto_estimado
    }))
  };

  return {
    success: true,
    data: {
      diagnostic: {
        id: pipelineResult.data.account_health.id,
        score_global: Number(pipelineResult.data.account_health.score_global ?? 0),
        estado_global: String(pipelineResult.data.account_health.estado_global ?? "critico")
      },
      recommendations: pipelineResult.data.recommendations,
      reportData
    }
  };
}
