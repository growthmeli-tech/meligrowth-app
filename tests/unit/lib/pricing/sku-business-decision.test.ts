import { describe, expect, it } from "vitest";
import { deriveSkuBusinessDecision, type SkuDecisionStateBase } from "@/lib/pricing/sku-decision-state";

function base(over: Partial<SkuDecisionStateBase> = {}): SkuDecisionStateBase {
  const d: SkuDecisionStateBase = {
    ml: {
      accountId: "a1",
      itemId: "MLA1",
      sku: "S1",
      title: "T",
      imageUrl: null,
      currentPrice: 10_000,
      stock: 5,
      ventas30d: 10,
      revenue30d: null,
      lastSaleDate: null,
      shippingMode: "me2",
      freeShipping: false,
      categoryId: null,
      listingType: null,
      condition: "new",
      packageWeightKg: 0.5
    },
    inputs: {
      productCost: 3000,
      logistics: "Flex",
      publicidadPct: 0,
      targetMarginPct: 0.2,
      safetyStockPct: 0.2,
      taxPct: 0,
      iibbPct: 0,
      additionalCosts: null
    },
    computed: {
      optimalPrice: 12_000,
      optimalGananciaUnit: 100,
      optimalRoi: 0.1,
      realProfit: 500,
      realMarginPct: 0.15,
      realComisionAmount: 100,
      realShippingAmount: 0,
      realAdsAmount: 0,
      realProductCostApplied: 3000,
      financialBreakdown: null,
      profitCompleteness: "net_full",
      breakEvenPrice: null,
      priceDelta: null,
      idealStock: null,
      stockGap: null,
      velocity30d: null,
      daysOfStock: null
    },
    decision: {
      profitabilityStatus: "healthy",
      stockStatus: "healthy",
      pricingStatus: "acceptable",
      priorityScore: 0,
      primaryInsight: null,
      recommendedAction: null,
      shippingMessage: null,
      shippingAction: null
    },
    sync: { calculationStatus: "valid" }
  };
  return { ...d, ...over, ml: { ...d.ml, ...over.ml }, inputs: { ...d.inputs, ...over.inputs } };
}

describe("deriveSkuBusinessDecision V3 precedence", () => {
  it("[1] missing_inputs → complete_shipping_data critical", () => {
    const s = deriveSkuBusinessDecision(base({ sync: { calculationStatus: "missing_inputs" } }));
    expect(s).toEqual({
      type: "complete_shipping_data",
      priority: "critical",
      message: "No se puede calcular este producto",
      action: "Completar datos",
      impactAmount: null
    });
  });

  it("[1] error → same blocker", () => {
    const s = deriveSkuBusinessDecision(base({ sync: { calculationStatus: "error" } }));
    expect(s.type).toBe("complete_shipping_data");
    expect(s.priority).toBe("critical");
  });

  it("[2] fiscal missing → configure_fiscal", () => {
    const b = {
      productCost: 3000,
      mlFeeAmount: 100,
      mlFeePct: 0.1,
      fixedUnitCost: null,
      adsAmount: 0,
      adsPct: 0,
      iibbAmount: null,
      iibbPct: null,
      taxAmount: null,
      taxPct: null,
      mlShippingAmount: 0,
      fulfillmentAmount: null,
      internalLogisticsAmount: null,
      additionalCostsAmount: null,
      totalCost: 5000,
      netProfit: 100,
      netMarginPct: 0.02,
      shipping: {
        sellerShippingCost: 0,
        source: "buyer_pays_shipping" as const,
        completeness: "complete" as const,
        priceBand: null,
        weightBand: null,
        reputationGroup: "unknown" as const,
        missing: [] as string[],
        reasons: [] as string[]
      },
      reasons: [],
      missing: ["iibb"]
    };
    const s = deriveSkuBusinessDecision(
      base({
        computed: {
          ...base().computed,
          financialBreakdown: b,
          profitCompleteness: "net_partial"
        }
      })
    );
    expect(s.type).toBe("configure_fiscal");
    expect(s.priority).toBe("high");
  });

  it("[3] freeShipping true + incomplete shipping → fix_shipping high", () => {
    const ship = {
      sellerShippingCost: null,
      source: "missing_data" as const,
      completeness: "partial" as const,
      priceBand: null,
      weightBand: null,
      reputationGroup: "unknown" as const,
      missing: ["package_weight"],
      reasons: []
    };
    const b = {
      productCost: 3000,
      mlFeeAmount: 100,
      mlFeePct: 0.1,
      fixedUnitCost: null,
      adsAmount: 0,
      adsPct: 0,
      iibbAmount: 0,
      iibbPct: 0,
      taxAmount: 0,
      taxPct: 0,
      mlShippingAmount: null,
      fulfillmentAmount: null,
      internalLogisticsAmount: null,
      additionalCostsAmount: null,
      totalCost: 8000,
      netProfit: 2000,
      netMarginPct: 0.2,
      shipping: ship,
      reasons: [],
      missing: [] as string[]
    };
    const s = deriveSkuBusinessDecision(
      base({
        ml: { ...base().ml, freeShipping: true },
        computed: { ...base().computed, financialBreakdown: b, realProfit: 2000, profitCompleteness: "net_partial" }
      })
    );
    expect(s.type).toBe("fix_shipping");
    expect(s.priority).toBe("high");
  });

  it("[4] freeShipping true + net loss → fix_shipping critical before fix_price", () => {
    const ship = {
      sellerShippingCost: 2000,
      source: "ml_ar_table_estimate" as const,
      completeness: "complete" as const,
      priceBand: "under_33000" as const,
      weightBand: "up_to_0_3" as const,
      reputationGroup: "leader_green_or_none" as const,
      missing: [] as string[],
      reasons: [] as string[]
    };
    const b = {
      productCost: 8000,
      mlFeeAmount: 500,
      mlFeePct: 0.1,
      fixedUnitCost: null,
      adsAmount: 0,
      adsPct: 0,
      iibbAmount: 0,
      iibbPct: 0,
      taxAmount: 0,
      taxPct: 0,
      mlShippingAmount: 2000,
      fulfillmentAmount: null,
      internalLogisticsAmount: null,
      additionalCostsAmount: null,
      totalCost: 12_000,
      netProfit: -2000,
      netMarginPct: -0.2,
      shipping: ship,
      reasons: [],
      missing: [] as string[]
    };
    const s = deriveSkuBusinessDecision(
      base({
        ml: { ...base().ml, freeShipping: true },
        computed: {
          ...base().computed,
          financialBreakdown: b,
          realProfit: -2000,
          realMarginPct: -0.2,
          profitCompleteness: "net_full"
        }
      })
    );
    expect(s.type).toBe("fix_shipping");
    expect(s.message).toBe("No podés vender con envío gratis");
    expect(s.priority).toBe("critical");
  });

  it("[5] loss without free shipping → fix_price; impact only when net_full", () => {
    const ship = {
      sellerShippingCost: 0,
      source: "buyer_pays_shipping" as const,
      completeness: "complete" as const,
      priceBand: null,
      weightBand: null,
      reputationGroup: "unknown" as const,
      missing: [] as string[],
      reasons: [] as string[]
    };
    const b = {
      productCost: 9000,
      mlFeeAmount: 500,
      mlFeePct: 0.1,
      fixedUnitCost: null,
      adsAmount: 0,
      adsPct: 0,
      iibbAmount: 0,
      iibbPct: 0,
      taxAmount: 0,
      taxPct: 0,
      mlShippingAmount: 0,
      fulfillmentAmount: null,
      internalLogisticsAmount: null,
      additionalCostsAmount: null,
      totalCost: 11_000,
      netProfit: -1000,
      netMarginPct: -0.1,
      shipping: ship,
      reasons: [],
      missing: [] as string[]
    };
    const full = deriveSkuBusinessDecision(
      base({
        ml: { ...base().ml, freeShipping: false },
        computed: {
          ...base().computed,
          financialBreakdown: b,
          realProfit: -1000,
          profitCompleteness: "net_full"
        }
      })
    );
    expect(full.type).toBe("fix_price");
    expect(full.impactAmount).toBe(-1000);

    const partial = deriveSkuBusinessDecision(
      base({
        ml: { ...base().ml, freeShipping: false },
        computed: {
          ...base().computed,
          financialBreakdown: b,
          realProfit: -1000,
          profitCompleteness: "net_partial"
        }
      })
    );
    expect(partial.impactAmount).toBeNull();
  });

  it("[6] margin below target → fix_price medium", () => {
    const s = deriveSkuBusinessDecision(
      base({
        computed: {
          ...base().computed,
          realProfit: 100,
          realMarginPct: 0.08,
          profitCompleteness: "net_full"
        }
      })
    );
    expect(s.type).toBe("fix_price");
    expect(s.priority).toBe("medium");
    expect(s.message).toBe("Margen bajo");
  });

  it("[7] stock critical when prior rules pass", () => {
    const s = deriveSkuBusinessDecision(
      base({
        computed: {
          ...base().computed,
          realProfit: 800,
          realMarginPct: 0.25,
          profitCompleteness: "net_full"
        },
        decision: { ...base().decision, stockStatus: "critical" }
      })
    );
    expect(s.type).toBe("replenish_stock");
    expect(s.priority).toBe("medium");
  });

  it("[8] default hold", () => {
    const s = deriveSkuBusinessDecision(
      base({
        computed: {
          ...base().computed,
          realProfit: 800,
          realMarginPct: 0.25,
          profitCompleteness: "net_full"
        },
        decision: { ...base().decision, stockStatus: "healthy" }
      })
    );
    expect(s.type).toBe("hold");
    expect(s.priority).toBe("low");
  });
});
