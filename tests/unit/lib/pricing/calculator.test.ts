import { describe, expect, it } from "vitest";
import { calculatePricing, comparePricingPlans, selectRecommendedPricingPlan, toNumber } from "@/lib/pricing";

describe("Calculadora de precios", () => {
  const input = {
    plan: "growth" as const,
    currentRevenue: 8_000_000,
    projectedRevenue: 11_500_000,
    grossMarginPct: 32,
    deliveryCost: 280_000,
    setupFee: 100_000,
    months: 6
  };

  it("calcula fee mensual y margen del operador", () => {
    const result = calculatePricing(input);
    expect(result.variableCommission).toBe(210_000);
    expect(result.monthlyFee).toBe(860_000);
    expect(result.operatorMarginPct).toBe(67);
  });

  it("marca recomendado cuando supera umbrales de negocio", () => {
    expect(calculatePricing(input).recommended).toBe(true);
  });

  it("ordena comparativa de planes y selecciona uno viable", () => {
    const plans = comparePricingPlans(input);
    expect(plans).toHaveLength(3);
    expect(selectRecommendedPricingPlan(input).plan).toBe("starter");
  });

  it("normaliza strings numericos con separador local", () => {
    expect(toNumber("1.500.000")).toBe(1_500_000);
    expect(toNumber("10,5")).toBe(10.5);
  });
});
