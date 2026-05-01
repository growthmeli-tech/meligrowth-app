import { describe, expect, it } from "vitest";
import { calculateFinancialCostBreakdown } from "@/lib/pricing/calculator";
import {
  mapMlSellerReputation,
  resolvePriceBand,
  resolveShippingReputationGroup,
  resolveWeightBand,
  estimateSellerShippingCostAr,
  resolveSellerReputationForRow,
  type SellerReputation
} from "@/lib/pricing/shipping-costs-argentina";
import { makeDecisionCacheKey } from "@/lib/pricing/decision-state-cache";
import type { BuildSkuDecisionStateInput } from "@/lib/pricing/sku-decision-state";

describe("resolvePriceBand boundaries", () => {
  it("tramos AR pesos", () => {
    expect(resolvePriceBand(32_999)).toBe("under_33000");
    expect(resolvePriceBand(33_000)).toBe("from_33000_to_49999");
    expect(resolvePriceBand(49_999)).toBe("from_33000_to_49999");
    expect(resolvePriceBand(50_000)).toBe("from_50000");
  });
});

describe("resolveWeightBand boundaries", () => {
  it("0.4 kg → from_0_3_to_0_5", () => {
    expect(resolveWeightBand(0.4)).toBe("from_0_3_to_0_5");
  });
  it("extremos", () => {
    expect(resolveWeightBand(0.15)).toBe("up_to_0_3");
    expect(resolveWeightBand(200)).toBe("over_180");
    expect(resolveWeightBand(null)).toBeNull();
  });
});

describe("mapMlSellerReputation", () => {
  it("yellow / green / orange / red / unknown", () => {
    expect(mapMlSellerReputation({ levelId: "yellow", powerSellerStatus: null })).toBe("yellow");
    expect(mapMlSellerReputation({ levelId: "green", powerSellerStatus: null })).toBe("green");
    expect(mapMlSellerReputation({ levelId: "5_green", powerSellerStatus: null })).toBe("green");
    expect(mapMlSellerReputation({ levelId: "4_light_green", powerSellerStatus: null })).toBe("green");
    expect(mapMlSellerReputation({ levelId: "green", powerSellerStatus: "platinum" })).toBe("mercado_lider_green");
    expect(mapMlSellerReputation({ levelId: "orange", powerSellerStatus: null })).toBe("orange");
    expect(mapMlSellerReputation({ levelId: "red", powerSellerStatus: null })).toBe("red");
    expect(mapMlSellerReputation({ levelId: "", powerSellerStatus: null })).toBe("unknown");
  });
});

describe("reputation group mapping", () => {
  it("agrupa leader_green_or_none y orange_or_red", () => {
    expect(resolveShippingReputationGroup("green")).toBe("leader_green_or_none");
    expect(resolveShippingReputationGroup("no_reputation")).toBe("leader_green_or_none");
    expect(resolveShippingReputationGroup("yellow")).toBe("yellow");
    expect(resolveShippingReputationGroup("orange")).toBe("orange_or_red");
    expect(resolveShippingReputationGroup("unknown")).toBe("unknown");
  });
});

describe("estimateSellerShippingCostAr — tabla yellow AR", () => {
  const yellow = "yellow" as SellerReputation;
  const base = {
    reputation: yellow,
    shippingMode: "flex" as const,
    condition: "new" as const,
    packageWeightKg: 0.4
  };

  it("freeShipping=false => seller 0 para cualquier modo", () => {
    for (const mode of ["full", "flex", "me2"] as const) {
      const e = estimateSellerShippingCostAr({
        ...base,
        price: 30_000,
        freeShipping: false,
        shippingMode: mode
      });
      expect(e.sellerShippingCost).toBe(0);
      expect(e.source).toBe("buyer_pays_shipping");
      expect(e.completeness).toBe("complete");
    }
  });

  it("yellow + 0.4kg + 30k / 40k / 60k", () => {
    expect(
      estimateSellerShippingCostAr({ ...base, price: 30_000, freeShipping: true }).sellerShippingCost
    ).toBe(9824);
    expect(
      estimateSellerShippingCostAr({ ...base, price: 40_000, freeShipping: true }).sellerShippingCost
    ).toBe(7368);
    expect(
      estimateSellerShippingCostAr({ ...base, price: 60_000, freeShipping: true }).sellerShippingCost
    ).toBe(7920);
  });

  it("freeShipping true + unknown reputation + cuenta sin sync => missing_reputation", () => {
    const e = estimateSellerShippingCostAr({
      ...base,
      price: 30_000,
      freeShipping: true,
      reputation: "unknown",
      accountReputationSynced: false
    });
    expect(e.source).toBe("missing_reputation");
    expect(e.completeness).toBe("partial");
    expect(e.sellerShippingCost).toBeNull();
  });

  it("freeShipping true + unknown reputation => partial", () => {
    const e = estimateSellerShippingCostAr({
      ...base,
      price: 30_000,
      freeShipping: true,
      reputation: "unknown"
    });
    expect(e.source).toBe("missing_data");
    expect(e.completeness).toBe("partial");
    expect(e.sellerShippingCost).toBeNull();
  });

  it("freeShipping true + missing weight => partial", () => {
    const e = estimateSellerShippingCostAr({
      ...base,
      price: 30_000,
      freeShipping: true,
      packageWeightKg: null
    });
    expect(e.completeness).toBe("partial");
    expect(e.sellerShippingCost).toBeNull();
  });

  it("freeShipping true + green (sin tabla) => partial", () => {
    const e = estimateSellerShippingCostAr({
      ...base,
      price: 30_000,
      freeShipping: true,
      reputation: "green",
      packageWeightKg: 0.4
    });
    expect(e.source).toBe("missing_table");
    expect(e.completeness).toBe("partial");
  });

  it("used => partial unless new table", () => {
    const e = estimateSellerShippingCostAr({
      ...base,
      price: 30_000,
      freeShipping: true,
      condition: "used"
    });
    expect(e.completeness).toBe("partial");
    expect(e.missing).toContain("condition_new_table");
  });
});

describe("Financial breakdown — shipping subtract", () => {
  it("solo resta envío con estimate completo", () => {
    const bComplete = calculateFinancialCostBreakdown({
      salePrice: 40_000,
      productCost: 10_000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null,
      shipping: {
        packageWeightKg: 0.4,
        reputation: "yellow",
        shippingMode: "flex",
        freeShipping: true,
        condition: "new"
      }
    });
    expect(bComplete.shipping.completeness).toBe("complete");
    expect(bComplete.mlShippingAmount).toBe(7368);
    expect(bComplete.netProfit).not.toBeNull();
    expect(bComplete.cashInAmount).toBe(27_132);
  });

  it("parcial envío no resta costo en total", () => {
    const bPartial = calculateFinancialCostBreakdown({
      salePrice: 40_000,
      productCost: 10_000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null,
      shipping: {
        packageWeightKg: null,
        reputation: "yellow",
        shippingMode: "flex",
        freeShipping: true,
        condition: "new"
      }
    });
    expect(bPartial.shipping.completeness).toBe("partial");
    expect(bPartial.mlShippingAmount).toBeNull();
    const bNoShip = calculateFinancialCostBreakdown({
      salePrice: 40_000,
      productCost: 10_000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null,
      shipping: {
        packageWeightKg: 0.4,
        reputation: "yellow",
        shippingMode: "flex",
        freeShipping: true,
        condition: "new"
      }
    });
    expect(bPartial.netProfit).toBeGreaterThan(bNoShip.netProfit!);
  });
});

describe("resolveSellerReputationForRow", () => {
  it("prioriza cuenta sincronizada sobre pricing (tier ML)", () => {
    expect(
      resolveSellerReputationForRow({
        accountLevel: "yellow",
        accountPower: null,
        accountSyncedAt: "2026-01-01",
        legacyPricingReputacion: "Verde / MercadoLíder"
      })
    ).toBe("yellow");
  });

  it("sin sync ignora legado margen → unknown para envío", () => {
    expect(
      resolveSellerReputationForRow({
        accountLevel: null,
        accountPower: null,
        accountSyncedAt: null,
        legacyPricingReputacion: "Verde / MercadoLíder"
      })
    ).toBe("unknown");
  });

  it("synced + tier ML ausente → no_reputation", () => {
    expect(
      resolveSellerReputationForRow({
        accountLevel: null,
        accountPower: null,
        accountSyncedAt: "2026-01-01",
        legacyPricingReputacion: "Verde / MercadoLíder"
      })
    ).toBe("no_reputation");
  });
});

describe("estimateSellerShippingCostAr — no_reputation tier", () => {
  it("no_reputation + freeShipping no marca ml_reputation missing; grupo leader_green_or_none", () => {
    const e = estimateSellerShippingCostAr({
      price: 30_000,
      packageWeightKg: 0.4,
      reputation: "no_reputation",
      shippingMode: "flex",
      freeShipping: true,
      condition: "new"
    });
    expect(e.reputationGroup).toBe("leader_green_or_none");
    expect(e.missing.some((m) => m.includes("ml_reputation"))).toBe(false);
    expect(e.completeness).toBe("partial");
    expect(e.source).toBe("missing_table");
  });
});

describe("decision cache key — shipping drivers", () => {
  const base = (): BuildSkuDecisionStateInput => ({
    accountId: "acc",
    accountReputation: {
      sellerReputationLevel: "green",
      sellerPowerSellerStatus: null,
      sellerReputationSyncedAt: "t1"
    },
    ml: {
      currentPrice: 100,
      stock: 1,
      ventas30d: 0,
      freeShipping: true,
      shippingMode: "me2",
      packageWeightKg: 1,
      condition: "new"
    },
    inputs: { productCost: 50, logistics: "Flex", publicidadPct: 0, targetMarginPct: 0.2 }
  });

  it("cambia con freeShipping / peso / reputación / reputation_state", () => {
    const a = makeDecisionCacheKey("sku1", base());
    const b = makeDecisionCacheKey("sku1", {
      ...base(),
      ml: { ...base().ml, freeShipping: false }
    });
    expect(a).not.toBe(b);
    const c = makeDecisionCacheKey("sku1", {
      ...base(),
      ml: { ...base().ml, packageWeightKg: 2 }
    });
    expect(a).not.toBe(c);
    const noTier = makeDecisionCacheKey("sku1", {
      ...base(),
      accountReputation: {
        sellerReputationLevel: null,
        sellerPowerSellerStatus: null,
        sellerReputationSyncedAt: "t1"
      }
    });
    expect(a).not.toBe(noTier);
  });
});
