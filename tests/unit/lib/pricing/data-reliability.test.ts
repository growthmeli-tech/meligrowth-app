import { describe, expect, it } from "vitest";
import {
  auditFreeShippingContractFromParsedCatalog,
  buildCatalogDataTrust,
  buildDataCompleteness,
  computeDecisionConfidence,
  computeOperabilityStatus,
  detectFlexFromMlShipping,
  resolveMlFreeShippingKeyPresentForRow
} from "@/lib/pricing/data-reliability";

describe("resolveMlFreeShippingKeyPresentForRow", () => {
  it("persisted boolean wins over value shape", () => {
    expect(resolveMlFreeShippingKeyPresentForRow(false, true)).toBe(false);
    expect(resolveMlFreeShippingKeyPresentForRow(true, undefined)).toBe(true);
  });
  it("infers present when ML returned a boolean and persist is unknown", () => {
    expect(resolveMlFreeShippingKeyPresentForRow(undefined, false)).toBe(true);
    expect(resolveMlFreeShippingKeyPresentForRow(null, true)).toBe(true);
  });
  it("null ML value without persist stays unknown", () => {
    expect(resolveMlFreeShippingKeyPresentForRow(undefined, null)).toBe(null);
    expect(resolveMlFreeShippingKeyPresentForRow(null, null)).toBe(null);
  });
});

describe("auditFreeShippingContractFromParsedCatalog", () => {
  it("counts missing key vs explicit null", () => {
    const a = auditFreeShippingContractFromParsedCatalog([
      { free_shipping_key_present: false, free_shipping: null },
      { free_shipping_key_present: true, free_shipping: null },
      { free_shipping_key_present: true, free_shipping: false }
    ]);
    expect(a.total).toBe(3);
    expect(a.freeShippingKeyMissing).toBe(1);
    expect(a.freeShippingExplicitNull).toBe(1);
  });
});

describe("detectFlexFromMlShipping", () => {
  it("detects self_service tag (not logistic_type alone)", () => {
    const r = detectFlexFromMlShipping({ tags: ["self_service_in"], methods: [] });
    expect(r.detected).toBe(true);
    expect(r.reasons.some((x) => x.includes("self_service"))).toBe(true);
  });
  it("does not flag ME2-like empty tags/methods", () => {
    expect(detectFlexFromMlShipping({ tags: [], methods: [] }).detected).toBe(false);
  });
  it("flags same_day in method id", () => {
    const r = detectFlexFromMlShipping({ tags: [], methods: [{ id: "same_day", name: "X" }] });
    expect(r.detected).toBe(true);
  });
});

describe("operability + confidence (deterministic)", () => {
  it("missing cost → blocked + low", () => {
    const c = buildDataCompleteness({
      priceMl: 100,
      productCost: null,
      stock: 1,
      mlFreeShippingBoolean: false,
      mlFreeShippingKeyPresent: true,
      mlPackageWeightKg: 1
    });
    const op = computeOperabilityStatus(c, false);
    expect(op).toBe("blocked");
    const conf = computeDecisionConfidence({
      completeness: c,
      operability: op,
      mlFreeShippingKeyPresent: true,
      effectiveFreeShipping: false
    });
    expect(conf.level).toBe("low");
    expect(conf.reasons).toContain("missing:cost_pricing_sku");
  });

  it("missing freeShipping resolved null → partial", () => {
    const c = buildDataCompleteness({
      priceMl: 100,
      productCost: 10,
      stock: 1,
      mlFreeShippingBoolean: null,
      mlFreeShippingKeyPresent: true,
      mlPackageWeightKg: 1
    });
    const op = computeOperabilityStatus(c, null);
    expect(op).toBe("partial");
  });

  it("complete SKU → operable + high confidence", () => {
    const c = buildDataCompleteness({
      priceMl: 100,
      productCost: 10,
      stock: 1,
      mlFreeShippingBoolean: false,
      mlFreeShippingKeyPresent: true,
      mlPackageWeightKg: 1
    });
    const op = computeOperabilityStatus(c, false);
    expect(op).toBe("operable");
    const conf = computeDecisionConfidence({
      completeness: c,
      operability: op,
      mlFreeShippingKeyPresent: true,
      effectiveFreeShipping: false
    });
    expect(conf.level).toBe("high");
  });

  it("undefined freeShipping contract (key absent) → low", () => {
    const c = buildDataCompleteness({
      priceMl: 100,
      productCost: 10,
      stock: 1,
      mlFreeShippingBoolean: null,
      mlFreeShippingKeyPresent: false,
      mlPackageWeightKg: 1
    });
    const op = computeOperabilityStatus(c, null);
    const conf = computeDecisionConfidence({
      completeness: c,
      operability: op,
      mlFreeShippingKeyPresent: false,
      effectiveFreeShipping: null
    });
    expect(conf.level).toBe("low");
    expect(conf.reasons.some((r) => r.includes("ml_contract"))).toBe(true);
  });
});

describe("buildCatalogDataTrust", () => {
  it("bundles flex signals without mutating freeShipping semantics", () => {
    const t = buildCatalogDataTrust({
      priceMl: 50,
      productCost: 5,
      stock: 2,
      mlFreeShippingBoolean: true,
      mlFreeShippingKeyPresent: true,
      mlPackageWeightKg: 0.2,
      effectiveFreeShipping: true,
      shippingTags: ["self_service"],
      shippingMethods: []
    });
    expect(t.flexDetected).toBe(true);
    expect(t.operabilityStatus).toBe("operable");
  });
});
