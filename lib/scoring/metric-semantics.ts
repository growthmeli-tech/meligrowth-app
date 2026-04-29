/**
 * Semántica central de presencia/ausencia de métricas en scoring (MeliGrowth OPS).
 *
 * - Valor numérico explícito (incl. cero real) → siempre pasa por `calcScore` en {@link ./block-calculations}.
 * - `null` en métrica obligatoria del snapshot → no se degrada a 0 (evita “perfecto” o “desastre” falsos).
 * - `null` en métrica opcional (Zona B / manual no cargado) → se excluye del promedio ponderado del bloque.
 *
 * Alineado a docs/estado-actual-ops.md §8.2 (null vs 0).
 */

/** Frontera desarrollo/riesgo en la escala de score por métrica; refleja snapshot incompleto de forma acotada. */
export const INCOMPLETE_MANDATORY_METRIC_SCORE = 55;

export function weightedAverage(parts: Array<[number, number]>): number {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return 0;
  return Math.round(parts.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight);
}

export function capWhenCritical(score: number, metricScores: number[]) {
  return metricScores.some((metricScore) => metricScore < 45) ? Math.min(score, 55) : score;
}

export function isNumericPresent(value: number | null | undefined): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Entrada formulario / FormData: blanco o inválido → `null` (nunca forzar 0).
 * Usar en server actions y parsers de carga manual junto a snapshots v2.
 */
export function parseManualNumericInput(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Métricas Zona B u opcionales: ausentes se excluyen del bloque (ver metric-snapshot.ts). */
export function isOptionalManualMetricField(metricKey: string): boolean {
  return (
    metricKey === "pubs_optimizadas_pct" ||
    metricKey === "ctr" ||
    metricKey === "dias_stock" ||
    metricKey === "lead_time_reposicion" ||
    metricKey === "sistema_reposicion"
  );
}
