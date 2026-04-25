import { calcScore } from "@/lib/scoring";
import type { Database } from "@/lib/supabase/database.types";
import { ACCIONES_POR_METRICA } from "@/lib/recommendations/actions";
import { analyzeAds } from "@/lib/recommendations/ads-analyzer";
import { benchmarkToObjective, getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import { getPrioridadRecomendacion, sortByPriority } from "@/lib/recommendations/priorities";
import { getScoreStatus, getStrategyForScore } from "@/lib/recommendations/score-interpreter";
import type { DiagnosticRecommendations, MetricInput, Recommendation, RecommendationAudience, RecommendationCategory } from "@/lib/recommendations/types";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

const METRIC_INPUTS: Array<Omit<MetricInput, "valor"> & { source: keyof DiagnosticRow }> = [
  { campo: "reclamos", categoria: "salud", peso: 0.3, source: "reclamos" },
  { campo: "mediaciones", categoria: "salud", peso: 0.25, source: "mediaciones" },
  { campo: "cancelaciones_vendedor", categoria: "salud", peso: 0.25, source: "cancelaciones_vendedor" },
  { campo: "envios_a_tiempo", categoria: "salud", peso: 0.2, source: "envios_a_tiempo" },
  { campo: "pubs_activas_pct", categoria: "publicaciones", peso: 0.4, source: "pubs_activas_pct" },
  { campo: "pubs_optimizadas_pct", categoria: "publicaciones", peso: 0.35, source: "pubs_optimizadas_pct" },
  { campo: "ctr", categoria: "publicaciones", peso: 0.25, source: "ctr" },
  { campo: "acos", categoria: "ads", peso: 0.45, source: "acos" },
  { campo: "roas", categoria: "ads", peso: 0.3, source: "roas" },
  { campo: "incidencias_pct", categoria: "logistica", peso: 0.4, source: "incidencias_pct" },
  { campo: "uso_full_flex_pct", categoria: "logistica", peso: 0.3, source: "uso_full_flex_pct" },
  { campo: "cancelaciones_stock_pct", categoria: "logistica", peso: 0.3, source: "cancelaciones_stock_pct" },
  { campo: "skus_sin_stock_pct", categoria: "stock", peso: 0.4, source: "skus_sin_stock_pct" },
  { campo: "dias_stock", categoria: "stock", peso: 0.35, source: "dias_stock" },
  { campo: "lead_time_reposicion", categoria: "stock", peso: 0.25, source: "lead_time_reposicion" }
];

const BLOQUE_LABEL: Record<RecommendationCategory, string> = {
  salud: "01 Salud",
  publicaciones: "02 Publicaciones",
  ads: "03 Ads",
  logistica: "04 Logistica",
  stock: "05 Stock"
};

const METRIC_TITLES: Record<string, string> = {
  reclamos: "Bajar reclamos",
  mediaciones: "Reducir mediaciones",
  cancelaciones_vendedor: "Corregir cancelaciones por vendedor",
  envios_a_tiempo: "Recuperar envios a tiempo",
  pubs_activas_pct: "Reactivar publicaciones",
  pubs_optimizadas_pct: "Optimizar catalogo",
  ctr: "Mejorar CTR",
  acos: "Reducir ACOS",
  roas: "Mejorar ROAS",
  incidencias_pct: "Reducir incidencias logisticas",
  uso_full_flex_pct: "Aumentar uso Full/Flex",
  cancelaciones_stock_pct: "Bajar cancelaciones por stock",
  skus_sin_stock_pct: "Reponer SKUs sin stock",
  dias_stock: "Normalizar dias de stock",
  lead_time_reposicion: "Reducir lead time de reposicion"
};

const AUDIENCE_BY_CATEGORY: Record<RecommendationCategory, RecommendationAudience> = {
  salud: "both",
  publicaciones: "operator",
  ads: "operator",
  logistica: "both",
  stock: "operator"
};

export function generateRecommendations(diagnostic: DiagnosticRow): DiagnosticRecommendations {
  const recomendaciones: Recommendation[] = [];
  const globalStatus = getScoreStatus(diagnostic.score_global);
  const estrategia = getStrategyForScore(diagnostic.score_global);

  for (const metric of METRIC_INPUTS) {
    const raw = diagnostic[metric.source];
    if (typeof raw !== "number") continue;

    const scoreMetrica = calcScore(metric.campo, raw);
    const status = getStatusFromScore(scoreMetrica);
    if (status === "platinum") continue;
    const accion = ACCIONES_POR_METRICA[metric.campo]?.[status];
    if (!accion) continue;

    const benchmarkDef = getBenchmarkDefinition(metric.categoria, metric.campo);
    const objective = benchmarkDef ? benchmarkToObjective(benchmarkDef) : "Sin objetivo";
    const brecha = getGap(metric.categoria, metric.campo, raw);

    const prioridad =
      metric.categoria === "salud" && (status === "critico" || status === "en_riesgo" || (metric.campo === "envios_a_tiempo" && raw < 88))
        ? "urgente"
        : getPrioridadRecomendacion(status, metric.categoria);

    recomendaciones.push({
      id: `${diagnostic.id}-${metric.campo}`,
      categoria: metric.categoria,
      prioridad,
      titulo: METRIC_TITLES[metric.campo] ?? `Mejorar ${metric.campo}`,
      descripcion: `${metric.campo} en estado ${status.replace("_", " ")} con valor actual ${formatNumber(raw)}.`,
      accion_concreta: accion,
      metrica_afectada: metric.campo,
      impacto_estimado: getImpactLabel(metric.peso, scoreMetrica),
      benchmark_objetivo: objective,
      audiencia: AUDIENCE_BY_CATEGORY[metric.categoria],
      bloque: BLOQUE_LABEL[metric.categoria]
    });

    if (brecha !== null && Math.abs(brecha) > 0) {
      recomendaciones[recomendaciones.length - 1].descripcion += ` Brecha estimada: ${formatNumber(brecha)}.`;
    }
  }

  const adsAnalysis = hasAdsData(diagnostic)
    ? analyzeAds({
        margen_pre_ads: diagnostic.margen_pre_ads ?? 0,
        gasto_ads: diagnostic.gasto_ads ?? 0,
        ventas_ads: diagnostic.ventas_ads ?? 0,
        ventas_totales: diagnostic.ventas_totales ?? 0
      })
    : null;

  if (adsAnalysis && adsAnalysis.estado_salud !== "sin_datos") {
    const prioridad = adsAnalysis.estado_salud === "critico" ? "urgente" : adsAnalysis.estado_salud === "aceptable" ? "alta" : "media";
    recomendaciones.push({
      id: `${diagnostic.id}-ads-analysis`,
      categoria: "ads",
      prioridad,
      titulo: "Analizar rentabilidad de Ads",
      descripcion: `ACOS ${formatNumber(adsAnalysis.acos)}%, ROAS ${formatNumber(adsAnalysis.roas)}x, TACOS ${formatNumber(adsAnalysis.tacos)}%.`,
      accion_concreta: adsAnalysis.recomendacion,
      metrica_afectada: "ads_profitability",
      impacto_estimado: "Impacto alto en margen total",
      benchmark_objetivo: "ROAS > break-even y TACOS < 13% del margen",
      audiencia: "operator",
      bloque: BLOQUE_LABEL.ads
    });
  }

  return {
    client_id: diagnostic.client_id,
    diagnostic_id: diagnostic.id,
    score_global: diagnostic.score_global,
    estado_global: globalStatus,
    estrategia_general: estrategia.accion,
    recomendacion_ads: adsAnalysis?.recomendacion ?? estrategia.ads,
    recomendaciones: sortByPriority(recomendaciones),
    bloques_criticos: getCriticalBlocks(diagnostic),
    bloques_saludables: getHealthyBlocks(diagnostic),
    generated_at: new Date().toISOString()
  };
}

function hasAdsData(diagnostic: DiagnosticRow) {
  return diagnostic.gasto_ads !== null && diagnostic.ventas_ads !== null && diagnostic.ventas_totales !== null;
}

function getCriticalBlocks(diagnostic: DiagnosticRow): string[] {
  return [
    { label: BLOQUE_LABEL.salud, score: diagnostic.score_salud },
    { label: BLOQUE_LABEL.publicaciones, score: diagnostic.score_publicaciones },
    { label: BLOQUE_LABEL.ads, score: diagnostic.score_ads },
    { label: BLOQUE_LABEL.logistica, score: diagnostic.score_logistica },
    { label: BLOQUE_LABEL.stock, score: diagnostic.score_stock }
  ]
    .filter((block) => typeof block.score === "number" && block.score < 55)
    .map((block) => block.label);
}

function getHealthyBlocks(diagnostic: DiagnosticRow): string[] {
  return [
    { label: BLOQUE_LABEL.salud, score: diagnostic.score_salud },
    { label: BLOQUE_LABEL.publicaciones, score: diagnostic.score_publicaciones },
    { label: BLOQUE_LABEL.ads, score: diagnostic.score_ads },
    { label: BLOQUE_LABEL.logistica, score: diagnostic.score_logistica },
    { label: BLOQUE_LABEL.stock, score: diagnostic.score_stock }
  ]
    .filter((block) => typeof block.score === "number" && block.score >= 85)
    .map((block) => block.label);
}

function getGap(categoria: RecommendationCategory, metrica: string, valor: number) {
  const def = getBenchmarkDefinition(categoria, metrica);
  if (!def) return null;
  const objective = def.levels.find((item) => item.score === 95) ?? def.levels.find((item) => item.score === 100);
  if (!objective) return null;

  if (objective.minValue !== undefined && valor < objective.minValue) return objective.minValue - valor;
  if (objective.maxValue !== undefined && valor > objective.maxValue) return objective.maxValue - valor;
  return null;
}

function getImpactLabel(peso: number, scoreMetrica: number) {
  const improvement = Math.round((100 - scoreMetrica) * peso);
  if (improvement >= 18) return `Impacto muy alto (+${improvement} pts potenciales del bloque)`;
  if (improvement >= 10) return `Impacto alto (+${improvement} pts potenciales del bloque)`;
  if (improvement >= 5) return `Impacto medio (+${improvement} pts potenciales del bloque)`;
  return "Impacto bajo incremental";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
