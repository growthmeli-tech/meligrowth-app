import { describe, expect, it } from "vitest";
import {
  buildPricingAutomationCandidate,
  resolveMlPricePushReadiness,
  resolveProfitKind,
  resolveRowOperability,
  resolveSellerShippingCostStatus
} from "@/lib/pricing/operability-resolver";
import { buildSkuDecisionState } from "@/lib/pricing/sku-decision-state";

const BASE = {
  accountId: "acc-1",
  ml: {
    itemId: "MLA1",
    sku: "SKU-1",
    title: "Producto",
    currentPrice: 20_000,
    stock: 10,
    shippingMode: "me2",
    logisticType: "cross_docking",
    freeShipping: false,
    condition: "new",
    packageWeightKg: null
  },
  inputs: {
    productCost: 10_000,
    logistics: "Retiro domicilio" as const,
    publicidadPct: 0,
    targetMarginPct: 0.2,
    reputacion: "Amarilla"
  },
  financialSettings: {
    taxPct: 0,
    iibbPct: 0,
    internalLogisticsCost: null,
    fixedUnitCost: null,
    additionalCostsPct: null,
    additionalCostsFixed: null,
    fullFulfillmentCostPerUnit: null,
    fullStorageCostPerUnit: null,
    fullInboundCostPerUnit: null
  }
};

describe("operability resolver", () => {
  it("freeShipping=false yields not_applicable and operable", () => {
    const d = buildSkuDecisionState(BASE);
    expect(resolveSellerShippingCostStatus(d)).toEqual({
      kind: "not_applicable",
      reason: "buyer_pays_shipping"
    });
    expect(resolveRowOperability(d)).toEqual({ status: "operable", reason: null });
  });

  it("freeShipping=true + missing weight is partial with exact reason", () => {
    const d = buildSkuDecisionState({
      ...BASE,
      ml: { ...BASE.ml, freeShipping: true }
    });
    expect(resolveSellerShippingCostStatus(d).kind).toBe("missing_weight");
    expect(resolveRowOperability(d)).toEqual({
      status: "partial",
      reason: "Falta peso para envio ML"
    });
  });

  it("safeToPush is true only when row is operable and real", () => {
    const d = buildSkuDecisionState(BASE);
    const ready = resolveMlPricePushReadiness({
      itemId: "MLA1",
      currentPrice: 20_000,
      recommendedPrice: 21_000,
      decision: d
    });
    expect(resolveProfitKind(d.computed)).toBe("real");
    expect(ready.safeToPushMlPrice).toBe(true);
    expect(ready.blockedReason).toBeNull();
  });

  it("automation candidate exposes canonical fields", () => {
    const d = buildSkuDecisionState(BASE);
    const c = buildPricingAutomationCandidate({
      itemId: "MLA1",
      currentPrice: 20_000,
      recommendedPrice: 21_000,
      decision: d
    });
    expect(c.itemId).toBe("MLA1");
    expect(c.safeToPush).toBe(true);
    expect(c.operabilityStatus).toBe("operable");
    expect(c.sellerShippingCostStatus).toBe("not_applicable");
  });
});
