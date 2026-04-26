import { describe, expect, it } from "vitest";
import { calcLogisticaScore } from "@/lib/scoring";

describe("Bloque 04 - Logistica", () => {
  it("penaliza incidencias y bajo uso de full/flex", () => {
    const score = calcLogisticaScore({
      incidencias_pct: 8,
      uso_full_flex_pct: 20,
      cancelaciones_stock_pct: 5
    });
    expect(score).toBeLessThan(55);
  });

  it("premia una operacion estable", () => {
    const score = calcLogisticaScore({
      incidencias_pct: 1,
      uso_full_flex_pct: 85,
      cancelaciones_stock_pct: 0.5
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
