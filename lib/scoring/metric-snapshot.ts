import { hasMeaningfulAdsActivity } from "@/lib/ops/meaningful-ads";
import type { AdsData, BloqueScores } from "@/lib/types";
import {
  calcAdsScore,
  calcScore,
  calcScoreGlobal
} from "@/lib/scoring/block-calculations";
import {
  capWhenCritical,
  INCOMPLETE_MANDATORY_METRIC_SCORE,
  isNumericPresent,
  weightedAverage
} from "@/lib/scoring/metric-semantics";
import { getDecision, getEstado } from "@/lib/scoring/scoring-outcomes";

export type MetricSnapshotForScoring = {
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
};

/** Claves alineadas a `metric_snapshots` / carga manual interna (una sola fuente para defaults y POST). */
export const MANUAL_FORM_METRIC_KEYS = [
  "reclamos",
  "mediaciones",
  "cancelaciones_vendedor",
  "envios_a_tiempo",
  "pubs_activas_pct",
  "pubs_optimizadas_pct",
  "ctr",
  "margen_pre_ads",
  "gasto_ads",
  "ventas_ads",
  "ventas_totales",
  "acos",
  "roas",
  "tacos",
  "incidencias_pct",
  "uso_full_flex_pct",
  "cancelaciones_stock_pct",
  "skus_sin_stock_pct",
  "dias_stock",
  "lead_time_reposicion",
  "sistema_reposicion"
] as const;

export type ManualFormMetricKey = (typeof MANUAL_FORM_METRIC_KEYS)[number];

export function emptyManualFormValues(): Record<ManualFormMetricKey, number | null> {
  return Object.fromEntries(MANUAL_FORM_METRIC_KEYS.map((k) => [k, null])) as Record<ManualFormMetricKey, number | null>;
}

export function initialManualFormValuesFromSnapshot(snapshot: Record<string, unknown> | null): Record<ManualFormMetricKey, number | null> {
  const base = emptyManualFormValues();
  if (!snapshot) return base;
  for (const key of MANUAL_FORM_METRIC_KEYS) {
    const raw = snapshot[key];
    base[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }
  return base;
}

/** Convierte el estado del formulario manual al shape de scoring v2 (null preservado). */
export function metricSnapshotFromManualFormValues(values: Record<string, number | null | undefined>): MetricSnapshotForScoring {
  const pick = (key: keyof MetricSnapshotForScoring): number | null => {
    const v = values[key as string];
    if (v === undefined || v === null) return null;
    return v;
  };
  return {
    reclamos: pick("reclamos"),
    mediaciones: pick("mediaciones"),
    cancelaciones_vendedor: pick("cancelaciones_vendedor"),
    envios_a_tiempo: pick("envios_a_tiempo"),
    pubs_activas_pct: pick("pubs_activas_pct"),
    pubs_optimizadas_pct: pick("pubs_optimizadas_pct"),
    ctr: pick("ctr"),
    margen_pre_ads: pick("margen_pre_ads"),
    gasto_ads: pick("gasto_ads"),
    ventas_ads: pick("ventas_ads"),
    ventas_totales: pick("ventas_totales"),
    acos: pick("acos"),
    roas: pick("roas"),
    tacos: pick("tacos"),
    incidencias_pct: pick("incidencias_pct"),
    uso_full_flex_pct: pick("uso_full_flex_pct"),
    cancelaciones_stock_pct: pick("cancelaciones_stock_pct"),
    skus_sin_stock_pct: pick("skus_sin_stock_pct"),
    dias_stock: pick("dias_stock"),
    lead_time_reposicion: pick("lead_time_reposicion"),
    sistema_reposicion: pick("sistema_reposicion")
  };
}

/** Igual que `hasAdsSnapshotData` en pipeline-v2: actividad ads + ventas_totales presente. */
export function hasAdsSnapshotDataForManualForm(values: Record<string, number | null | undefined>): boolean {
  const s = metricSnapshotFromManualFormValues(values);
  return hasMeaningfulAdsActivity(s) && s.ventas_totales != null && s.ventas_totales !== undefined;
}

function mandatoryMetricScore(metrica: string, raw: number | null | undefined): number {
  if (!isNumericPresent(raw)) return INCOMPLETE_MANDATORY_METRIC_SCORE;
  return calcScore(metrica, raw);
}

/** Derivados Ads para scoring/recomendaciones; sin actividad significativa devuelve nulls salvo TACOS si aplica. */
export function deriveAdsDerivedMetrics(snapshot: MetricSnapshotForScoring): {
  acos: number | null;
  roas: number | null;
  tacos: number | null;
} {
  const gasto = snapshot.gasto_ads;
  const vAds = snapshot.ventas_ads;
  const vTot = snapshot.ventas_totales;

  const g = typeof gasto === "number" ? gasto : 0;
  const va = typeof vAds === "number" ? vAds : 0;
  const vt = typeof vTot === "number" ? vTot : 0;

  if (!hasMeaningfulAdsActivity(snapshot)) {
    return { acos: null, roas: null, tacos: vt > 0 ? (g / vt) * 100 : null };
  }

  return {
    acos: snapshot.acos ?? (va > 0 ? (g / va) * 100 : null),
    roas: snapshot.roas ?? (g > 0 ? va / g : null),
    tacos: snapshot.tacos ?? (vt > 0 ? (g / vt) * 100 : null)
  };
}

export function calcSaludScoreFromSnapshot(snapshot: Pick<MetricSnapshotForScoring, "reclamos" | "mediaciones" | "cancelaciones_vendedor" | "envios_a_tiempo">): number {
  const scores = [
    mandatoryMetricScore("reclamos", snapshot.reclamos),
    mandatoryMetricScore("mediaciones", snapshot.mediaciones),
    mandatoryMetricScore("cancelaciones_vendedor", snapshot.cancelaciones_vendedor),
    mandatoryMetricScore("envios_a_tiempo", snapshot.envios_a_tiempo)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 30], [scores[1], 20], [scores[2], 25], [scores[3], 25]]), scores);
}

export function calcPublicacionesScoreFromSnapshot(
  snapshot: Pick<MetricSnapshotForScoring, "pubs_activas_pct" | "pubs_optimizadas_pct" | "ctr">
): number {
  const parts: Array<[number, number]> = [];
  const metricScores: number[] = [];

  parts.push([mandatoryMetricScore("pubs_activas_pct", snapshot.pubs_activas_pct), 35]);
  metricScores.push(parts[0][0]);

  if (isNumericPresent(snapshot.pubs_optimizadas_pct)) {
    const s = calcScore("pubs_optimizadas_pct", snapshot.pubs_optimizadas_pct);
    parts.push([s, 45]);
    metricScores.push(s);
  }
  if (isNumericPresent(snapshot.ctr)) {
    const s = calcScore("ctr", snapshot.ctr);
    parts.push([s, 20]);
    metricScores.push(s);
  }

  if (parts.length === 0) return INCOMPLETE_MANDATORY_METRIC_SCORE;

  const totalW = parts.reduce((a, [, w]) => a + w, 0);
  const raw = Math.round(parts.reduce((sum, [sc, w]) => sum + sc * w, 0) / totalW);
  return capWhenCritical(raw, metricScores);
}

export function calcLogisticaScoreFromSnapshot(
  snapshot: Pick<MetricSnapshotForScoring, "incidencias_pct" | "uso_full_flex_pct" | "cancelaciones_stock_pct">
): number {
  const scores = [
    mandatoryMetricScore("incidencias_pct", snapshot.incidencias_pct),
    mandatoryMetricScore("uso_full_flex_pct", snapshot.uso_full_flex_pct),
    mandatoryMetricScore("cancelaciones_stock_pct", snapshot.cancelaciones_stock_pct)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 35], [scores[1], 40], [scores[2], 25]]), scores);
}

export function calcStockScoreFromSnapshot(
  snapshot: Pick<MetricSnapshotForScoring, "skus_sin_stock_pct" | "dias_stock" | "lead_time_reposicion" | "sistema_reposicion">
): number {
  const parts: Array<[number, number]> = [];
  const metricScores: number[] = [];

  parts.push([mandatoryMetricScore("skus_sin_stock_pct", snapshot.skus_sin_stock_pct), 35]);
  metricScores.push(parts[0][0]);

  if (isNumericPresent(snapshot.dias_stock)) {
    const s = calcScore("dias_stock", snapshot.dias_stock);
    parts.push([s, 25]);
    metricScores.push(s);
  }
  if (isNumericPresent(snapshot.lead_time_reposicion)) {
    const s = calcScore("lead_time_reposicion", snapshot.lead_time_reposicion);
    parts.push([s, 20]);
    metricScores.push(s);
  }
  if (isNumericPresent(snapshot.sistema_reposicion)) {
    const s = calcScore("sistema_reposicion", snapshot.sistema_reposicion);
    parts.push([s, 20]);
    metricScores.push(s);
  }

  const totalW = parts.reduce((a, [, w]) => a + w, 0);
  const raw = Math.round(parts.reduce((sum, [sc, w]) => sum + sc * w, 0) / totalW);
  return capWhenCritical(raw, metricScores);
}

function buildAdsDataForScoring(snapshot: MetricSnapshotForScoring): AdsData {
  const meaningful = hasMeaningfulAdsActivity(snapshot);
  const adsMetrics = deriveAdsDerivedMetrics(snapshot);
  const margen = snapshot.margen_pre_ads != null ? snapshot.margen_pre_ads : 0;
  const gasto = snapshot.gasto_ads != null ? snapshot.gasto_ads : 0;
  const va = snapshot.ventas_ads != null ? snapshot.ventas_ads : 0;
  const vt = snapshot.ventas_totales != null ? snapshot.ventas_totales : 0;

  return {
    margen_pre_ads: margen,
    gasto_ads: gasto,
    ventas_ads: va,
    ventas_totales: vt,
    acos: meaningful ? (adsMetrics.acos ?? 0) : 0,
    roas: meaningful ? (adsMetrics.roas ?? 0) : 0,
    tacos: meaningful ? (adsMetrics.tacos ?? 0) : 0
  };
}

export function calcAdsScoreFromMetricSnapshot(snapshot: MetricSnapshotForScoring): number {
  return calcAdsScore(buildAdsDataForScoring(snapshot));
}

export function calcBloqueScoresFromMetricSnapshot(snapshot: MetricSnapshotForScoring): BloqueScores {
  return {
    salud: calcSaludScoreFromSnapshot(snapshot),
    publicaciones: calcPublicacionesScoreFromSnapshot(snapshot),
    ads: calcAdsScoreFromMetricSnapshot(snapshot),
    logistica: calcLogisticaScoreFromSnapshot(snapshot),
    stock: calcStockScoreFromSnapshot(snapshot)
  };
}

export function scoreDiagnosticFromMetricSnapshot(
  snapshot: MetricSnapshotForScoring,
  options?: { hasAdsData?: boolean }
) {
  const scores = calcBloqueScoresFromMetricSnapshot(snapshot);
  const scoreGlobal = calcScoreGlobal(scores, options);
  const estado = getEstado(scoreGlobal);
  return {
    scores,
    scoreGlobal,
    estadoGlobal: estado,
    decision: getDecision(estado, scores)
  };
}
