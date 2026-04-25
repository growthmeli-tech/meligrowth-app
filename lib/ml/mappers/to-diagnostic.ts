import type { MlDiagnosticPrefill } from "@/lib/ml/mappers/types";

const numberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function mapScraperMetricsToPrefill(metrics: Record<string, unknown>): Partial<MlDiagnosticPrefill> {
  return {
    reclamos: numberOrNull(metrics.reclamos),
    mediaciones: numberOrNull(metrics.mediaciones),
    cancelaciones_vendedor: numberOrNull(metrics.cancelaciones_vendedor),
    envios_a_tiempo: numberOrNull(metrics.envios_a_tiempo),
    pubs_activas_pct: numberOrNull(metrics.pubs_activas_pct),
    pubs_optimizadas_pct: numberOrNull(metrics.pubs_optimizadas_pct),
    ctr: numberOrNull(metrics.ctr),
    gasto_ads: numberOrNull(metrics.gasto_ads),
    ventas_ads: numberOrNull(metrics.ventas_ads),
    ventas_totales: numberOrNull(metrics.ventas_totales),
    acos: numberOrNull(metrics.acos),
    roas: numberOrNull(metrics.roas),
    tacos: numberOrNull(metrics.tacos),
    incidencias_pct: numberOrNull(metrics.incidencias_pct),
    uso_full_flex_pct: numberOrNull(metrics.uso_full_flex_pct),
    cancelaciones_stock_pct: numberOrNull(metrics.cancelaciones_stock_pct),
    skus_sin_stock_pct: numberOrNull(metrics.skus_sin_stock_pct),
    dias_stock: numberOrNull(metrics.dias_stock),
    lead_time_reposicion: numberOrNull(metrics.lead_time_reposicion)
  };
}
