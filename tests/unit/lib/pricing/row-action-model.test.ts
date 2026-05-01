import { describe, expect, it } from "vitest";
import { buildRowActionModel } from "@/lib/pricing/row-action-model";
import type { SellerShippingCostStatus } from "@/lib/pricing/operability-resolver";
import type { CashInDisplay, OptimalPriceDisplay, ProfitDisplay } from "@/lib/pricing/financial-display";
import type { OperabilityStatus } from "@/lib/pricing/data-reliability";

function makeInput(over: Partial<Parameters<typeof buildRowActionModel>[0]> = {}) {
  const profitDisplay: ProfitDisplay = { kind: "real", amount: 1000, marginPct: 0.2, label: "real" };
  const cashInDisplay: CashInDisplay = { kind: "real", amount: 15000 };
  const optimalPriceDisplay: OptimalPriceDisplay = { kind: "real", amount: 21000 };
  const sellerShippingCostStatus: SellerShippingCostStatus = { kind: "not_applicable", reason: "buyer_pays_shipping" };
  const operabilityStatus: OperabilityStatus = "operable";
  return {
    itemId: "MLA-1",
    pricingSkuId: "sku-1",
    currentPrice: 20000,
    recommendedPrice: 21000,
    productCost: 9000,
    freeShipping: false,
    operabilityStatus,
    profitDisplay,
    cashInDisplay,
    optimalPriceDisplay,
    sellerShippingCostStatus,
    financialMissing: [],
    financialCompleteness: "complete" as const,
    ...over
  };
}

describe("row-action-model", () => {
  it("missing cost -> configure_cost", () => {
    const model = buildRowActionModel(makeInput({ productCost: null }));
    expect(model.primaryAction).toBe("configure_cost");
    expect(model.label).toBe("Configurar costo");
  });

  it("safe row -> push_ml_price", () => {
    const model = buildRowActionModel(makeInput());
    expect(model.primaryAction).toBe("push_ml_price");
    expect(model.canPushMlPrice).toBe(true);
  });

  it("freeShipping=false + no weight still pushes when safe", () => {
    const model = buildRowActionModel(makeInput({ freeShipping: false }));
    expect(model.primaryAction).toBe("push_ml_price");
    expect(model.canPushMlPrice).toBe(true);
  });

  it("freeShipping=false never returns shipping missing reason", () => {
    const model = buildRowActionModel(
      makeInput({
        freeShipping: false,
        sellerShippingCostStatus: { kind: "not_applicable", reason: "buyer_pays_shipping" },
        profitDisplay: { kind: "estimated", amount: 1200, marginPct: 0.1, label: "estimado", missing: ["tax"] }
      })
    );
    expect(model.primaryAction).toBe("complete_data");
    expect(model.sublabel).not.toContain("envío");
  });

  it("freeShipping=true + missing weight -> complete_data with exact reason", () => {
    const model = buildRowActionModel(
      makeInput({
        freeShipping: true,
        sellerShippingCostStatus: { kind: "missing_weight" },
        profitDisplay: { kind: "estimated", amount: 1200, marginPct: 0.1, label: "estimado", missing: ["package_weight"] },
        cashInDisplay: { kind: "estimated", amount: 14000, missing: ["package_weight"] },
        operabilityStatus: "partial"
      })
    );
    expect(model.primaryAction).toBe("complete_data");
    expect(model.sublabel).toBe("Falta peso para envío");
  });

  it("freeShipping=true + missing table -> complete_data with exact reason", () => {
    const model = buildRowActionModel(
      makeInput({
        freeShipping: true,
        sellerShippingCostStatus: { kind: "missing_table" },
        profitDisplay: { kind: "estimated", amount: 1200, marginPct: 0.1, label: "estimado", missing: ["shipping_table_for_reputation"] },
        cashInDisplay: { kind: "estimated", amount: 14000, missing: ["shipping_table_for_reputation"] },
        operabilityStatus: "partial"
      })
    );
    expect(model.primaryAction).toBe("complete_data");
    expect(model.sublabel).toBe("Falta tabla de envío");
  });

  it("missing recommended price -> complete_data", () => {
    const model = buildRowActionModel(makeInput({ recommendedPrice: null }));
    expect(model.primaryAction).toBe("complete_data");
    expect(model.sublabel).toBe("Sin precio recomendado");
  });

  it("estimated profit -> complete_data / Cálculo parcial", () => {
    const model = buildRowActionModel(
      makeInput({
        profitDisplay: { kind: "estimated", amount: 1000, marginPct: 0.1, label: "estimado", missing: ["tax"] },
        cashInDisplay: { kind: "real", amount: 15000 }
      })
    );
    expect(model.primaryAction).toBe("complete_data");
    expect(model.sublabel).toBe("Cálculo parcial");
  });
});
