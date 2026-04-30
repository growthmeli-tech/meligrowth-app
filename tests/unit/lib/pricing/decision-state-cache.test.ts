import { describe, expect, it, beforeEach } from "vitest";
import {
  getCachedDecisionState,
  getDecisionStateCache,
  invalidateDecisionCacheBySkuId,
  makeDecisionCacheKey,
  resetDecisionStateCacheForTests
} from "@/lib/pricing/decision-state-cache";
import type { BuildSkuDecisionStateInput } from "@/lib/pricing/sku-decision-state";

function sampleInput(over: Partial<BuildSkuDecisionStateInput["ml"] & BuildSkuDecisionStateInput["inputs"]> = {}): BuildSkuDecisionStateInput {
  return {
    accountId: "acc",
    ml: {
      itemId: "MLA1",
      sku: "S",
      title: "T",
      imageUrl: null,
      currentPrice: 1000,
      stock: 5,
      ventas30d: 1,
      revenue30d: null,
      lastSaleDate: null,
      shippingMode: "Flex",
      freeShipping: null,
      categoryId: null,
      listingType: null,
      ...(over as Partial<BuildSkuDecisionStateInput["ml"]>)
    },
    inputs: {
      productCost: 100,
      logistics: "Flex",
      publicidadPct: 0.1,
      targetMarginPct: 0.2,
      pesoKg: 1,
      reputacion: "Verde / MercadoLíder",
      ...(over as Partial<BuildSkuDecisionStateInput["inputs"]>)
    }
  };
}

describe("makeDecisionCacheKey", () => {
  it("is deterministic for identical inputs", () => {
    const a = sampleInput();
    expect(makeDecisionCacheKey("sku-1", a)).toBe(makeDecisionCacheKey("sku-1", a));
  });

  it("changes when skuId or economic inputs change", () => {
    const base = sampleInput();
    const k0 = makeDecisionCacheKey("sku-1", base);
    expect(makeDecisionCacheKey("sku-2", base)).not.toBe(k0);
    const alt: BuildSkuDecisionStateInput = { ...base, ml: { ...base.ml, currentPrice: 2000 } };
    expect(makeDecisionCacheKey("sku-1", alt)).not.toBe(k0);
  });
});

describe("getCachedDecisionState", () => {
  beforeEach(() => {
    resetDecisionStateCacheForTests();
  });

  it("returns same reference for identical key (single build)", () => {
    const input = sampleInput();
    const s1 = getCachedDecisionState("r1", input);
    const s2 = getCachedDecisionState("r1", input);
    expect(s1).toBe(s2);
  });

  it("invalidateBySku drops that partition only", () => {
    const input = sampleInput();
    const a = getCachedDecisionState("a", input);
    const b = getCachedDecisionState("b", input);
    expect(a).not.toBe(b);
    invalidateDecisionCacheBySkuId("a");
    const a2 = getCachedDecisionState("a", input);
    const b2 = getCachedDecisionState("b", input);
    expect(a2).not.toBe(a);
    expect(b2).toBe(b);
  });

  it("keeps cache size bounded (LRU)", () => {
    resetDecisionStateCacheForTests();
    const input = sampleInput();
    for (let i = 0; i < 10_002; i += 1) {
      getCachedDecisionState(`sku-${i}`, input);
    }
    expect(getDecisionStateCache().size()).toBe(10_000);
  });
});
