import { calcScore } from "@/lib/scoring";
import type { Database } from "@/lib/supabase/database.types";
import { ACCIONES_POR_METRICA } from "@/lib/recommendations/actions";
import { analyzeAds } from "@/lib/recommendations/ads-analyzer";
import { benchmarkToObjective, getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import { getPrioridadRecomendacion, sortByPriority } from "@/lib/recommendations/priorities";
import { buildOperationalRecommendations } from "@/lib/recommendations/operational-signals";
import { getScoreStatus, getStrategyForScore } from "@/lib/recommendations/score-interpreter";
import type { DiagnosticRecommendations, MetricInput, Recommendation, RecommendationAudience, RecommendationCategory } from "@/lib/recommendations/types";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
export type RecommendationsDiagnosticInput = Pick<
  DiagnosticRow,
  | "id"
  | "client_id"
  | "score_global"
  | "reclamos"
  | "mediaciones"
  | "cancelaciones_vendedor"
  | "envios_a_tiempo"
  | "pubs_activas_pct"
  | "pubs_optimizadas_pct"
  | "ctr"
  | "acos"
  | "roas"
  | "incidencias_pct"
  | "uso_full_flex_pct"
  | "cancelaciones_stock_pct"
  | "skus_sin_stock_pct"
  | "dias_stock"
  | "lead_time_reposicion"
  | "margen_pre_ads"
  | "gasto_ads"
  | "ventas_ads"
  | "ventas_totales"
  | "score_salud"
  | "score_publicaciones"
  | "score_ads"
  | "score_logistica"
  | "score_stock"
>;

type MetricInputRow = Omit<MetricInput, "valor"> & {
  source: keyof RecommendationsDiagnosticInput;
  /** Zona B (doc producto): null = dato no cargado / no aplica — no castigar. */
  optionalZonaB?: boolean;
  /** No interpretar ACOS/ROAS sin gasto o ventas atribuibles a Ads (evita “ACOS 0 = óptimo”). */
  requiereAdsActividad?: boolean;
};

const METRIC_INPUTS: MetricInputRow[] = [
  { campo: "reclamos", categoria: "salud", peso: 0.3, source: "reclamos" },
  { campo: "mediaciones", categoria: "salud", peso: 0.25, source: "mediaciones" },
  { campo: "cancelaciones_vendedor", categoria: "salud", peso: 0.25, source: "cancelaciones_vendedor" },
  { campo: "envios_a_tiempo", categoria: "salud", peso: 0.2, source: "envios_a_tiempo" },
  { campo: "pubs_activas_pct", categoria: "publicaciones", peso: 0.4, source: "pubs_activas_pct" },
  { campo: "pubs_optimizadas_pct", categoria: "publicaciones", peso: 0.35, source: "pubs_optimizadas_pct", optionalZonaB: true },
  { campo: "ctr", categoria: "publicaciones", peso: 0.25, source: "ctr", optionalZonaB: true },
  { campo: "acos", categoria: "ads", peso: 0.45, source: "acos", requiereAdsActividad: true },
  { campo: "roas", categoria: "ads", peso: 0.3, source: "roas", requiereAdsActividad: true },
  { campo: "incidencias_pct", categoria: "logistica", peso: 0.4, source: "incidencias_pct" },
  { campo: "uso_full_flex_pct", categoria: "logistica", peso: 0.3, source: "uso_full_flex_pct" },
  { campo: "cancelaciones_stock_pct", categoria: "logistica", peso: 0.3, source: "cancelaciones_stock_pct" },
  { campo: "skus_sin_stock_pct", categoria: "stock", peso: 0.4, source: "skus_sin_stock_pct" },
  { campo: "dias_stock", categoria: "stock", peso: 0.35, source: "dias_stock", optionalZonaB: true },
  { campo: "lead_time_reposicion", categoria: "stock", peso: 0.25, source: "lead_time_reposicion", optionalZonaB: true }
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

function getAudienciaRecomendacion(input: {
  categoria: RecommendationCategory;
  campo: string;
  prioridad: Recommendation["prioridad"];
}): RecommendationAudience {
  const { categoria, campo, prioridad } = input;

  if (campo === "ads_profitability") {
    return prioridad === "urgente" ? "all" : "manager";
  }

  if (campo === "envios_a_tiempo" && prioridad === "urgente") {
    return "all";
  }

  if (categoria === "salud" && (prioridad === "urgente" || prioridad === "alta")) {
    return "internal";
  }

  if (campo === "roas") {
    return "manager";
  }

  if (categoria === "publicaciones" || categoria === "logistica" || categoria === "stock" || campo === "acos") {
    return "operator";
  }

  return "all";
}

export type GenerateRecommendationsOptions = {
  /** Origen por bloque (p. ej. api vs unavailable) — pipeline v2 */
  data_sources?: Record<string, string>;
};

function meaningfulAdsActivity(diagnostic: RecommendationsDiagnosticInput): boolean {
  return (
    (typeof diagnostic.gasto_ads === "number" && diagnostic.gasto_ads > 0) ||
    (typeof diagnostic.ventas_ads === "number" && diagnostic.ventas_ads > 0)
  );
}

export function generateRecommendations(
  diagnostic: RecommendationsDiagnosticInput,
  options?: GenerateRecommendationsOptions
): DiagnosticRecommendations {
  const recomendaciones: Recommendation[] = [];
  const globalStatus = getScoreStatus(diagnostic.score_global);
  const estrategia = getStrategyForScore(diagnostic.score_global);
  const meaningfulAds = meaningfulAdsActivity(diagnostic);

  for (const metric of METRIC_INPUTS) {
    const raw = diagnostic[metric.source];
    if (metric.optionalZonaB && (raw === null || raw === undefined)) continue;
    if (typeof raw !== "number") continue;
    if (metric.requiereAdsActividad && !meaningfulAds) continue;

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
      audiencia: getAudienciaRecomendacion({
        categoria: metric.categoria,
        campo: metric.campo,
        prioridad
      }),
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

  if (
    adsAnalysis &&
    adsAnalysis.estado_salud !== "sin_datos" &&
    adsAnalysis.estado_salud !== "sin_campanas"
  ) {
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
      audiencia: getAudienciaRecomendacion({
        categoria: "ads",
        campo: "ads_profitability",
        prioridad
      }),
      bloque: BLOQUE_LABEL.ads
    });
  }

  const operativas = buildOperationalRecommendations({
    diagnostic: {
      id: diagnostic.id,
      score_stock: diagnostic.score_stock,
      score_publicaciones: diagnostic.score_publicaciones,
      pubs_activas_pct: diagnostic.pubs_activas_pct,
      pubs_optimizadas_pct: diagnostic.pubs_optimizadas_pct,
      ctr: diagnostic.ctr,
      skus_sin_stock_pct: diagnostic.skus_sin_stock_pct,
      dias_stock: diagnostic.dias_stock,
      margen_pre_ads: diagnostic.margen_pre_ads,
      gasto_ads: diagnostic.gasto_ads,
      ventas_totales: diagnostic.ventas_totales
    },
    adsAnalysis,
    meaningfulAds,
    data_sources: options?.data_sources
  });

  return {
    client_id: diagnostic.client_id,
    diagnostic_id: diagnostic.id,
    score_global: diagnostic.score_global,
    estado_global: globalStatus,
    estrategia_general: estrategia.accion,
    recomendacion_ads:
      adsAnalysis && adsAnalysis.estado_salud !== "sin_datos" ? adsAnalysis.recomendacion : estrategia.ads,
    recomendaciones: sortByPriority([...recomendaciones, ...operativas]),
    bloques_criticos: getCriticalBlocks(diagnostic),
    bloques_saludables: getHealthyBlocks(diagnostic),
    generated_at: new Date().toISOString()
  };
}

function hasAdsData(diagnostic: RecommendationsDiagnosticInput) {
  return diagnostic.gasto_ads !== null && diagnostic.ventas_ads !== null && diagnostic.ventas_totales !== null;
}

function getCriticalBlocks(diagnostic: RecommendationsDiagnosticInput): string[] {
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

function getHealthyBlocks(diagnostic: RecommendationsDiagnosticInput): string[] {
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
