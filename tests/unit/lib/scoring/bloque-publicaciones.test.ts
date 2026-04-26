import { describe, expect, it } from "vitest";
import { calcPublicacionesScore } from "@/lib/scoring";

describe("Bloque 02 - Publicaciones", () => {
  it("retorna score alto con publicaciones activas y optimizadas", () => {
    const score = calcPublicacionesScore({
      pubs_activas_pct: 95,
      pubs_optimizadas_pct: 90,
      ctr: 4
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("cae por debajo de 60 con bajo porcentaje activo y ctr", () => {
    const score = calcPublicacionesScore({
      pubs_activas_pct: 45,
      pubs_optimizadas_pct: 40,
      ctr: 0.8
    });
    expect(score).toBeLessThan(60);
  });
});
