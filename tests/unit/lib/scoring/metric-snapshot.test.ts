import { describe, expect, it } from "vitest";
import { calcScore, calcPublicacionesScoreFromSnapshot, calcSaludScoreFromSnapshot, INCOMPLETE_MANDATORY_METRIC_SCORE } from "@/lib/scoring";

describe("metric-snapshot semantics", () => {
  it("no trata null en métrica obligatoria como cero real (envíos a tiempo)", () => {
    const base = {
      reclamos: 0.2,
      mediaciones: 0.1,
      cancelaciones_vendedor: 0.1,
      envios_a_tiempo: null as number | null
    };
    const withNull = calcSaludScoreFromSnapshot(base);
    const withZero = calcSaludScoreFromSnapshot({ ...base, envios_a_tiempo: 0 });
    expect(withNull).not.toBe(withZero);
    expect(calcScore("envios_a_tiempo", 0)).toBeLessThan(50);
    // Ausente (55) no iguala al cero real crítico en la curva de envíos
    expect(withZero).toBeLessThan(withNull);
  });

  it("no trata null en reclamos como cero real (cero reclamos es óptimo)", () => {
    const base = {
      reclamos: null as number | null,
      mediaciones: 0.1,
      cancelaciones_vendedor: 0.1,
      envios_a_tiempo: 99
    };
    const withNull = calcSaludScoreFromSnapshot(base);
    const withZero = calcSaludScoreFromSnapshot({ ...base, reclamos: 0 });
    expect(calcScore("reclamos", 0)).toBe(100);
    expect(withNull).not.toBe(withZero);
    expect(withNull).toBeLessThan(withZero);
  });

  it("métrica obligatoria ausente usa contribución acotada (55), no NaN ni 0 por benchmark", () => {
    expect(INCOMPLETE_MANDATORY_METRIC_SCORE).toBe(55);
  });

  it("opcionales Zona B ausentes se excluyen del bloque publicaciones sin relleno neutro", () => {
    const onlyActivas = calcPublicacionesScoreFromSnapshot({
      pubs_activas_pct: 90,
      pubs_optimizadas_pct: null,
      ctr: null
    });
    const withOptionalFilled = calcPublicacionesScoreFromSnapshot({
      pubs_activas_pct: 90,
      pubs_optimizadas_pct: 70,
      ctr: 2.0
    });
    expect(onlyActivas).toBe(calcScore("pubs_activas_pct", 90));
    expect(withOptionalFilled).not.toBe(onlyActivas);
  });
});
