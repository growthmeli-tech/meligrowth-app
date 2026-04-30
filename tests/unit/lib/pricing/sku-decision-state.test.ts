import { describe, expect, it } from "vitest";
import { buildSkuDecisionState } from "@/lib/pricing/sku-decision-state";

function base(): Parameters<typeof buildSkuDecisionState>[0] {
  return {
    accountId: "acc-1",
    financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
    ml: { itemId: "MLA1", title: "Producto test", sku: "SKU-1", freeShipping: false },
    inputs: { reputacion: "Verde / MercadoLíder" }
  };
}

describe("buildSkuDecisionState", () => {
  it("ads null becomes 0", () => {
    const b = base();
    const s = buildSkuDecisionState({
      ...b,
      inputs: { reputacion: b.inputs.reputacion, productCost: 10_000 }
    });
    expect(s.inputs.publicidadPct).toBe(0);
  });

  it("margin target null does not calculate optimal price", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, currentPrice: 25_000 },
      inputs: {
        ...base().inputs,
        productCost: 12_000,
        targetMarginPct: null,
        logistics: "Flex"
      }
    });
    expect(s.computed.optimalPrice).toBeNull();
    expect(s.decision.pricingStatus).toBe("unknown");
    expect(s.inputs.targetMarginPct).toBeNull();
  });

  it("missing cost returns missing_inputs", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, currentPrice: 20_000 },
      inputs: {
        ...base().inputs,
        productCost: null,
        targetMarginPct: 0.2,
        logistics: "Flex"
      }
    });
    expect(s.sync.calculationStatus).toBe("missing_inputs");
    expect(s.computed.realProfit).toBeNull();
    expect(s.computed.realMarginPct).toBeNull();
  });

  it("ventas30d null returns stockStatus syncing", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, ventas30d: null, stock: 10 },
      inputs: { ...base().inputs, productCost: 5000, logistics: "Flex", targetMarginPct: 0.15 }
    });
    expect(s.decision.stockStatus).toBe("syncing");
    expect(s.computed.daysOfStock).toBeNull();
  });

  it("ventas30d 0 returns stockStatus unknown", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, ventas30d: 0, stock: 5 },
      inputs: { ...base().inputs, productCost: 5000, logistics: "Flex", targetMarginPct: 0.15 }
    });
    expect(s.decision.stockStatus).toBe("unknown");
    expect(s.computed.velocity30d).toBe(0);
  });

  it("currentPrice + cost calculates real profit", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, currentPrice: 40_000 },
      inputs: {
        ...base().inputs,
        productCost: 15_000,
        logistics: "Flex",
        publicidadPct: 0,
        targetMarginPct: 0.2
      }
    });
    expect(s.computed.realProfit).not.toBeNull();
    expect(s.computed.realMarginPct).not.toBeNull();
    expect(s.sync.calculationStatus).not.toBe("missing_inputs");
    expect(Number.isFinite(s.computed.realProfit!)).toBe(true);
  });

  it("target margin calculates optimal price", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, currentPrice: 30_000 },
      inputs: {
        ...base().inputs,
        productCost: 12_000,
        logistics: "Flex",
        publicidadPct: 0.1,
        targetMarginPct: 0.15
      }
    });
    expect(s.computed.optimalPrice).not.toBeNull();
    expect(s.computed.optimalPrice!).toBeGreaterThan(0);
    expect(s.decision.pricingStatus).not.toBe("unknown");
  });

  it("loss generates loss insight", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: { ...base().ml, currentPrice: 8000 },
      inputs: {
        ...base().inputs,
        productCost: 15_000,
        logistics: "Flex",
        publicidadPct: 0,
        targetMarginPct: 0.2
      }
    });
    expect(s.decision.profitabilityStatus).toBe("loss");
    expect(s.decision.primaryInsight).toContain("Pierde plata");
  });

  it("profitable + ads 0 generates ads insight", () => {
    const s = buildSkuDecisionState({
      ...base(),
      ml: {
        ...base().ml,
        currentPrice: 55_000,
        stock: 200,
        ventas30d: 30
      },
      inputs: {
        ...base().inputs,
        productCost: 12_000,
        logistics: "Flex",
        publicidadPct: 0,
        targetMarginPct: 0.12
      }
    });
    expect(s.decision.profitabilityStatus).toBe("healthy");
    expect(s.inputs.publicidadPct).toBe(0);
    expect(s.decision.primaryInsight).toContain("sin Ads");
  });

  it("sin configuración fiscal explícita → partial y aviso en insight", () => {
    const b = base();
    const s = buildSkuDecisionState({
      ...b,
      financialSettings: undefined,
      ml: { ...b.ml, currentPrice: 30_000 },
      inputs: {
        ...b.inputs,
        productCost: 10_000,
        logistics: "Flex",
        publicidadPct: 0,
        targetMarginPct: 0.15
      }
    });
    expect(s.sync.calculationStatus).toBe("partial");
    expect(s.computed.financialBreakdown?.missing.some((m) => m === "iibb" || m === "tax")).toBe(true);
    expect(s.decision.primaryInsight).toMatch(/IIBB|impuestos|parcial/i);
  });
});
