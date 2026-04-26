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
      expect(["operator", "client", "both"]).toContain(item.audiencia);
    }
  });
});
