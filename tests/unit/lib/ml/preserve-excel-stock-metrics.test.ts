import { describe, expect, it } from "vitest";
import { preserveExcelStockMetrics } from "@/lib/ml/preserve-excel-stock-metrics";

describe("preserveExcelStockMetrics", () => {
  it("keeps Excel dias_stock and lead_time when ML returns null", () => {
    expect(
      preserveExcelStockMetrics(
        { skus_sin_stock_pct: 4, dias_stock: null, lead_time_reposicion: null },
        { skus_sin_stock_pct: 12, dias_stock: 32, lead_time_reposicion: 7 }
      )
    ).toEqual({
      skus_sin_stock_pct: 4,
      dias_stock: 32,
      lead_time_reposicion: 7
    });
  });

  it("keeps Excel skus_sin_stock_pct when the stock block is unavailable", () => {
    expect(
      preserveExcelStockMetrics(
        { skus_sin_stock_pct: null, dias_stock: null, lead_time_reposicion: null },
        { skus_sin_stock_pct: 12, dias_stock: 32, lead_time_reposicion: null }
      )
    ).toEqual({
      skus_sin_stock_pct: 12,
      dias_stock: 32,
      lead_time_reposicion: null
    });
  });

  it("treats missing existing snapshot as nulls", () => {
    expect(preserveExcelStockMetrics({ skus_sin_stock_pct: 4, dias_stock: null }, null)).toEqual({
      skus_sin_stock_pct: 4,
      dias_stock: null,
      lead_time_reposicion: null
    });
  });

  it("keeps a live 0% out-of-stock rate instead of falling back to Excel", () => {
    expect(
      preserveExcelStockMetrics(
        { skus_sin_stock_pct: 0, dias_stock: null, lead_time_reposicion: null },
        { skus_sin_stock_pct: 18, dias_stock: 40, lead_time_reposicion: 5 }
      )
    ).toEqual({
      skus_sin_stock_pct: 0,
      dias_stock: 40,
      lead_time_reposicion: 5
    });
  });

  it("ignores non-finite values", () => {
    expect(
      preserveExcelStockMetrics(
        { skus_sin_stock_pct: Number.NaN, dias_stock: Number.POSITIVE_INFINITY },
        { skus_sin_stock_pct: 9, dias_stock: 21 }
      )
    ).toEqual({
      skus_sin_stock_pct: 9,
      dias_stock: 21,
      lead_time_reposicion: null
    });
  });
});
