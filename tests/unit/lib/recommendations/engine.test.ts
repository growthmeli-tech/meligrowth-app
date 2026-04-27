import { describe, expect, it } from "vitest";
import { generateRecommendations } from "@/lib/recommendations/engine";
import { createMockDiagnostic, createPlatinumDiagnostic } from "@/tests/helpers/factories";

describe("Motor de recomendaciones", () => {
  it("prioriza salud como urgente cuando envios a tiempo cae por debajo de 88", () => {
    const result = generateRecommendations(createMockDiagnostic({ envios_a_tiempo: 85 }));
    const urgentes = result.recomendaciones.filter((item) => item.prioridad === "urgente");
    expect(urgentes.length).toBeGreaterThan(0);
  });

  it("ordena de urgente a baja", () => {
    const result = generateRecommendations(createMockDiagnostic());
    const order = ["urgente", "alta", "media", "baja"];
    for (let i = 1; i < result.recomendaciones.length; i += 1) {
      const prev = order.indexOf(result.recomendaciones[i - 1].prioridad);
      const current = order.indexOf(result.recomendaciones[i].prioridad);
      expect(prev).toBeLessThanOrEqual(current);
    }
  });

  it("cuenta platinum no recibe recomendaciones urgentes", () => {
    const result = generateRecommendations(createPlatinumDiagnostic());
    expect(result.recomendaciones.filter((item) => item.prioridad === "urgente")).toHaveLength(0);
  });

  it("caso v23 genera recomendacion urgente en ads", () => {
    const result = generateRecommendations(createMockDiagnostic());
    const adsRec = result.recomendaciones.find((item) => item.categoria === "ads");
    expect(adsRec?.prioridad).toBe("urgente");
    expect(result.recomendacion_ads).toMatch(/CRITICO|TACOS|margen/i);
  });

  it("cada recomendacion tiene forma completa", () => {
    const result = generateRecommendations(createMockDiagnostic());
    for (const item of result.recomendaciones) {
      expect(item.id).toBeTruthy();
      expect(item.titulo).toBeTruthy();
      expect(item.accion_concreta).toBeTruthy();
      expect(item.benchmark_objetivo).toBeTruthy();
      expect(["internal", "manager", "operator", "all"]).toContain(item.audiencia);
    }
  });

  it("asigna audiencia internal para alertas de salud de alta urgencia", () => {
    const result = generateRecommendations(createMockDiagnostic({ reclamos: 5 }));
    const rec = result.recomendaciones.find((item) => item.metrica_afectada === "reclamos");
    expect(rec?.audiencia).toBe("internal");
  });

  it("asigna audiencia all cuando envios a tiempo esta en nivel urgente", () => {
    const result = generateRecommendations(createMockDiagnostic({ envios_a_tiempo: 80 }));
    const rec = result.recomendaciones.find((item) => item.metrica_afectada === "envios_a_tiempo");
    expect(rec?.audiencia).toBe("all");
  });

  it("asigna audiencia manager para recomendaciones de rentabilidad ROAS", () => {
    const result = generateRecommendations(createMockDiagnostic({ roas: 1 }));
    const rec = result.recomendaciones.find((item) => item.metrica_afectada === "roas");
    expect(rec?.audiencia).toBe("manager");
  });
});
