import { describe, expect, it } from "vitest";
import { calcStockScore } from "@/lib/scoring";

describe("Bloque 05 - Stock", () => {
  it("castiga quiebres y reposicion lenta", () => {
    const score = calcStockScore({
      skus_sin_stock_pct: 30,
      dias_stock: 5,
      lead_time_reposicion: 25,
      sistema_reposicion: 20
    });
    expect(score).toBeLessThan(55);
  });

  it("da score alto con disponibilidad y sistema ordenado", () => {
    const score = calcStockScore({
      skus_sin_stock_pct: 1,
      dias_stock: 30,
      lead_time_reposicion: 2,
      sistema_reposicion: 95
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
