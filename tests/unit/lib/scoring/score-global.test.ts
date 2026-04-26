import { describe, expect, it } from "vitest";
import { calcScoreGlobal, getEstado } from "@/lib/scoring";

describe("Score global ponderado", () => {
  it("calcula el score global del caso v23 cercano a 63", () => {
    const score = calcScoreGlobal({
      salud: 67,
      publicaciones: 81,
      ads: 15,
      logistica: 81,
      stock: 82
    });
    expect(score).toBe(63);
  });

  it("respeta limites de estado", () => {
    expect(getEstado(95)).toBe("platinum");
    expect(getEstado(85)).toBe("solido");
    expect(getEstado(70)).toBe("desarrollo");
    expect(getEstado(55)).toBe("riesgo");
    expect(getEstado(39)).toBe("critico");
  });

  it("nunca supera 100 ni baja de 0 en extremos", () => {
    expect(calcScoreGlobal({ salud: 100, publicaciones: 100, ads: 100, logistica: 100, stock: 100 })).toBeLessThanOrEqual(100);
    expect(calcScoreGlobal({ salud: 0, publicaciones: 0, ads: 0, logistica: 0, stock: 0 })).toBeGreaterThanOrEqual(0);
  });
});
