import { calcScore } from "@/lib/scoring";
import { ACCIONES_POR_METRICA, OPS_BLOCKS, type OpsBlockKey, TRADUCCIONES_METRICAS } from "@/lib/ops/copy";
import { getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import { getScoreLabel } from "@/lib/utils/scores";

type Snapshot = {
  reclamos: number | null;
  mediaciones: number | null;
  cancelaciones_vendedor: number | null;
  envios_a_tiempo: number | null;
  pubs_activas_pct: number | null;
  pubs_optimizadas_pct: number | null;
  ctr: number | null;
  margen_pre_ads: number | null;
  gasto_ads: number | null;
  ventas_ads: number | null;
  ventas_totales: number | null;
  acos: number | null;
  roas: number | null;
  tacos: number | null;
  incidencias_pct: number | null;
  uso_full_flex_pct: number | null;
  cancelaciones_stock_pct: number | null;
  skus_sin_stock_pct: number | null;
  dias_stock: number | null;
  lead_time_reposicion: number | null;
  sistema_reposicion: number | null;
  data_sources: unknown;
};

type MetricCategory = "salud" | "publicaciones" | "ads" | "logistica" | "stock";

type MetricDefinition = {
  key: string;
  label: string;
  unit: "%" | "x" | "días" | "nivel";
  category: MetricCategory;
  criticalForCap?: boolean;
  resolveValue: (snapshot: Snapshot) => number | null;
};

export type OpsMetricRowData = {
  key: string;
  label: string;
  valor: number | null;
  unit: "%" | "x" | "días" | "nivel";
  score: number;
  estado: string;
  benchmark: string;
  accion: string;
  source: "api" | "manual" | null;
  esCritica: boolean;
};

const METRICS_BY_BLOCK: Record<OpsBlockKey, MetricDefinition[]> = {
  salud: [
    metric("reclamos", "salud", "%", true, (snapshot) => snapshot.reclamos),
    metric("mediaciones", "salud", "%", true, (snapshot) => snapshot.mediaciones),
    metric("cancelaciones_vendedor", "salud", "%", true, (snapshot) => snapshot.cancelaciones_vendedor),
    metric("envios_a_tiempo", "salud", "%", true, (snapshot) => snapshot.envios_a_tiempo)
  ],
  publicaciones: [
    metric("pubs_activas_pct", "publicaciones", "%", true, (snapshot) => snapshot.pubs_activas_pct),
    metric("pubs_optimizadas_pct", "publicaciones", "%", false, (snapshot) => snapshot.pubs_optimizadas_pct),
    metric("ctr", "publicaciones", "%", false, (snapshot) => snapshot.ctr)
  ],
  ads: [
    metric("acos", "ads", "%", true, (snapshot) => snapshot.acos ?? computeAcos(snapshot.gasto_ads, snapshot.ventas_ads)),
    metric("roas", "ads", "x", true, (snapshot) => snapshot.roas ?? computeRoas(snapshot.ventas_ads, snapshot.gasto_ads)),
    metric("tacos", "ads", "%", true, (snapshot) => snapshot.tacos ?? computeTacos(snapshot.gasto_ads, snapshot.ventas_totales)),
    metric("ventas_ads_pct", "ads", "%", false, (snapshot) => computeVentasAdsPct(snapshot.ventas_ads, snapshot.ventas_totales))
  ],
  logistica: [
    metric("incidencias_pct", "logistica", "%", true, (snapshot) => snapshot.incidencias_pct),
    metric("uso_full_flex_pct", "logistica", "%", true, (snapshot) => snapshot.uso_full_flex_pct),
    metric("cancelaciones_stock_pct", "logistica", "%", true, (snapshot) => snapshot.cancelaciones_stock_pct)
  ],
  stock: [
    metric("skus_sin_stock_pct", "stock", "%", true, (snapshot) => snapshot.skus_sin_stock_pct),
    metric("sistema_reposicion", "stock", "nivel", false, (snapshot) => snapshot.sistema_reposicion),
    metric("dias_stock", "stock", "días", false, (snapshot) => snapshot.dias_stock),
    metric("lead_time_reposicion", "stock", "días", false, (snapshot) => snapshot.lead_time_reposicion)
  ]
};

function metric(
  key: string,
  category: MetricCategory,
  unit: "%" | "x" | "días" | "nivel",
  criticalForCap: boolean,
  resolveValue: MetricDefinition["resolveValue"]
): MetricDefinition {
  return {
    key,
    label: TRADUCCIONES_METRICAS[key] ?? key,
    category,
    unit,
    criticalForCap,
    resolveValue
  };
}

export function getBlockMeta(blockKey: OpsBlockKey) {
  return OPS_BLOCKS.find((block) => block.key === blockKey) ?? OPS_BLOCKS[0];
}

export function getBlockMetricRows(blockKey: OpsBlockKey, snapshot: Snapshot): OpsMetricRowData[] {
  return METRICS_BY_BLOCK[blockKey].map((definition) => {
    const value = definition.resolveValue(snapshot);
    const numericScore = typeof value === "number" ? calcScore(definition.key, value) : 0;
    const benchmark = getBenchmarkDefinition(definition.category, definition.key);
    const benchmarkText = benchmark ? formatBenchmarkRanges(benchmark.levels) : "Sin benchmark definido";
    const source = resolveMetricSource(snapshot.data_sources, definition.key, blockKey);

    return {
      key: definition.key,
      label: definition.label,
      valor: value,
      unit: definition.unit,
      score: numericScore,
      estado: getScoreLabel(numericScore),
      benchmark: benchmarkText,
      accion: ACCIONES_POR_METRICA[definition.key] ?? "Revisá esta métrica con prioridad.",
      source,
      esCritica: Boolean(definition.criticalForCap)
    };
  });
}

export function getBlockContextHighlights(blockKey: OpsBlockKey, snapshot: Snapshot) {
  if (blockKey === "salud") {
    const score = snapshot.reclamos === null ? null : calcScore("reclamos", snapshot.reclamos);
    const reputacion = score === null ? "Sin datos de reputación" : score >= 95 ? "MercadoLíder Platinum" : score >= 70 ? "Reputación sólida" : "Reputación en riesgo";
    return [reputacion, "Cap inteligente activo si una métrica cae en crítico (<40)."];
  }

  if (blockKey === "publicaciones") {
    const activas = snapshot.pubs_activas_pct;
    return [activas === null ? "Sin datos de publicaciones activas." : `${activas.toFixed(1)}% de publicaciones activas sobre total.`, "Revisá publicaciones pausadas por stock y optimización de fichas."];
  }

  if (blockKey === "ads") {
    const margen = snapshot.margen_pre_ads;
    const acos = snapshot.acos ?? computeAcos(snapshot.gasto_ads, snapshot.ventas_ads);
    const roas = snapshot.roas ?? computeRoas(snapshot.ventas_ads, snapshot.gasto_ads);
    const roasBreakEven = margen && margen > 0 ? 1 / (margen / 100) : null;
    const highlights: string[] = [];
    if (acos !== null && margen !== null && acos > margen) highlights.push("Perdés plata por cada venta con ads.");
    if (roas !== null && roasBreakEven !== null && roas < roasBreakEven) {
      highlights.push(`Cada $1 en ads genera $${roas.toFixed(2)}. Necesitás al menos $${roasBreakEven.toFixed(2)}.`);
    }
    const tacos = snapshot.tacos ?? computeTacos(snapshot.gasto_ads, snapshot.ventas_totales);
    if (tacos !== null && margen !== null && tacos > margen * 0.65) highlights.push("La publicidad consume más que lo que ganás.");
    return highlights.length > 0 ? highlights : ["Bloque de ads sin alertas críticas de rentabilidad."];
  }

  if (blockKey === "logistica") {
    const usoFullFlex = snapshot.uso_full_flex_pct;
    return [usoFullFlex === null ? "Sin distribución Full/Flex reportada." : `Uso Full/Flex actual: ${usoFullFlex.toFixed(1)}%`, "Mantené envíos a tiempo y reducí incidencias para proteger reputación."];
  }

  const sistema = snapshot.sistema_reposicion;
  return [sistemaToLabel(sistema), "Priorizá reposición de SKUs de mayor rotación para sostener ventas."];
}

function formatBenchmarkRanges(levels: Array<{ score: number; label: string; maxValue?: number; minValue?: number }>) {
  return levels
    .map((level) => {
      if (level.minValue !== undefined && level.maxValue !== undefined) return `${level.minValue}-${level.maxValue} ${level.label.toLowerCase()}`;
      if (level.minValue !== undefined) return `>${level.minValue} ${level.label.toLowerCase()}`;
      if (level.maxValue !== undefined) return `<${level.maxValue} ${level.label.toLowerCase()}`;
      return level.label.toLowerCase();
    })
    .join(" · ");
}

function resolveMetricSource(dataSources: unknown, metric: string, block: OpsBlockKey): "api" | "manual" | null {
  if (!dataSources || typeof dataSources !== "object") return null;
  const record = dataSources as Record<string, unknown>;
  const metricSource = record[metric];
  if (metricSource === "api" || metricSource === "manual") return metricSource;
  const blockSource = record[block];
  if (blockSource === "api" || blockSource === "manual") return blockSource;
  return null;
}

function computeAcos(gastoAds: number | null, ventasAds: number | null): number | null {
  if (gastoAds === null || ventasAds === null || ventasAds <= 0) return null;
  return (gastoAds / ventasAds) * 100;
}

function computeRoas(ventasAds: number | null, gastoAds: number | null): number | null {
  if (ventasAds === null || gastoAds === null || gastoAds <= 0) return null;
  return ventasAds / gastoAds;
}

function computeTacos(gastoAds: number | null, ventasTotales: number | null): number | null {
  if (gastoAds === null || ventasTotales === null || ventasTotales <= 0) return null;
  return (gastoAds / ventasTotales) * 100;
}

function computeVentasAdsPct(ventasAds: number | null, ventasTotales: number | null): number | null {
  if (ventasAds === null || ventasTotales === null || ventasTotales <= 0) return null;
  return (ventasAds / ventasTotales) * 100;
}

function sistemaToLabel(value: number | null) {
  if (value === 4) return "Sistema de reposición: Automático ✅";
  if (value === 3) return "Sistema de reposición: Proceso definido 🟡";
  if (value === 2) return "Sistema de reposición: Informal ⚠️";
  if (value === 1) return "Sistema de reposición: Sin sistema 🔴";
  return "Sistema de reposición sin datos.";
}

export function statusFromScore(score: number) {
  return getStatusFromScore(score);
}
