import { describe, expect, it } from "vitest";
import { calcAdsScore } from "@/lib/scoring";

describe("Bloque 03 - Ads", () => {
  it("capea a 55 cuando ACOS supera la rentabilidad del margen", () => {
    const score = calcAdsScore({
      margen_pre_ads: 30,
      gasto_ads: 20000,
      ventas_ads: 10000,
      ventas_totales: 30000,
      acos: 200,
      roas: 0.5,
      tacos: 66.7
    });
    expect(score).toBeLessThanOrEqual(55);
  });

  it("retorna score saludable en caso rentable", () => {
    const score = calcAdsScore({
      margen_pre_ads: 30,
      gasto_ads: 3000,
      ventas_ads: 10000,
      ventas_totales: 30000,
      acos: 8,
      roas: 8,
      tacos: 6
    });
    expect(score).toBeGreaterThanOrEqual(80);
  });
});
