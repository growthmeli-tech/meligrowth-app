import { describe, expect, it } from "vitest";
import { calcSaludScore, calcScore } from "@/lib/scoring";

describe("Bloque 01 - Salud", () => {
  it("aplica cap 55 cuando hay una metrica critica", () => {
    const score = calcSaludScore({
      reclamos: 8,
      mediaciones: 0.2,
      cancelaciones_vendedor: 0.2,
      envios_a_tiempo: 70
    });
    expect(score).toBeLessThanOrEqual(55);
  });

  it("no aplica cap cuando todas las metricas estan solidas", () => {
    const score = calcSaludScore({
      reclamos: 0.1,
      mediaciones: 0.05,
      cancelaciones_vendedor: 0.1,
      envios_a_tiempo: 98
    });
    expect(score).toBeGreaterThan(72);
  });

  it("mantiene benchmarks esperados para reclamos y envios", () => {
    expect(calcScore("reclamos", 0.6)).toBeGreaterThanOrEqual(70);
    expect(calcScore("envios_a_tiempo", 90)).toBeLessThanOrEqual(72);
    expect(calcScore("reclamos", 0.1)).toBe(100);
  });
});
