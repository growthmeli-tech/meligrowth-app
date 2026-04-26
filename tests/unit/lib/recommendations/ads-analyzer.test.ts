import { describe, expect, it } from "vitest";
import { analyzeAds } from "@/lib/recommendations/ads-analyzer";

describe("Ads analyzer", () => {
  it("calcula ACOS, ROAS y TACOS correctamente", () => {
    const result = analyzeAds({
      margen_pre_ads: 30,
      gasto_ads: 20000,
      ventas_ads: 10000,
      ventas_totales: 30000
    });
    expect(result.acos).toBeCloseTo(200, 1);
    expect(result.roas).toBeCloseTo(0.5, 2);
    expect(result.tacos).toBeCloseTo(66.7, 1);
  });

  it("marca sin_datos cuando faltan valores para division", () => {
    const result = analyzeAds({
      margen_pre_ads: 30,
      gasto_ads: 0,
      ventas_ads: 0,
      ventas_totales: 30000
    });
    expect(result.estado_salud).toBe("sin_datos");
  });

  it("detecta estado critico con TACOS superior al 65% del margen", () => {
    const result = analyzeAds({
      margen_pre_ads: 30,
      gasto_ads: 12000,
      ventas_ads: 10000,
      ventas_totales: 20000
    });
    expect(result.estado_salud).toBe("critico");
  });

  it("detecta estado escalable con roas alto y tacos contenido", () => {
    const result = analyzeAds({
      margen_pre_ads: 30,
      gasto_ads: 1000,
      ventas_ads: 10000,
      ventas_totales: 100000
    });
    expect(result.estado_salud).toBe("escalable");
  });
});
