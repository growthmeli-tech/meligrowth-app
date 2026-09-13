/**
 * Excel `skus_stock` ingest writes coverage metrics onto the same
 * (ml_account_id, snapshot_date) row that ML sync upserts.
 *
 * `getStockMetrics` never computes days-of-stock or replenishment lead time
 * (always null). A successful sync must not null those Excel values.
 * Live `skus_sin_stock_pct` from ML still wins when present.
 */

export type ExcelStockMetrics = {
  skus_sin_stock_pct: number | null;
  dias_stock: number | null;
  lead_time_reposicion: number | null;
};

function pickFinite(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function preserveExcelStockMetrics(
  prefill: Partial<ExcelStockMetrics> | null | undefined,
  existing: Partial<ExcelStockMetrics> | null | undefined
): ExcelStockMetrics {
  return {
    skus_sin_stock_pct: pickFinite(prefill?.skus_sin_stock_pct) ?? pickFinite(existing?.skus_sin_stock_pct),
    dias_stock: pickFinite(prefill?.dias_stock) ?? pickFinite(existing?.dias_stock),
    lead_time_reposicion: pickFinite(prefill?.lead_time_reposicion) ?? pickFinite(existing?.lead_time_reposicion)
  };
}
