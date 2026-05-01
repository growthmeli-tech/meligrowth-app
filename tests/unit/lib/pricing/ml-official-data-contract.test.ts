import { describe, expect, it } from "vitest";
import { resolveFreeShippingProvenance, parsePackageWeightKgFromMl } from "@/lib/pricing/ml-official-data-contract";

describe("resolveFreeShippingProvenance", () => {
  it("ML boolean gana sobre simulación y configuración", () => {
    const r = resolveFreeShippingProvenance({
      mlApi: true,
      skuConfig: false,
      accountConfig: false,
      localSimulation: false
    });
    expect(r).toEqual({ value: true, source: "ml_api" });
  });

  it("sin ML, aplica sku → account → sim", () => {
    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        skuConfig: true,
        accountConfig: true,
        localSimulation: true
      })
    ).toEqual({ value: true, source: "sku_config" });

    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        skuConfig: null,
        accountConfig: false,
        localSimulation: true
      })
    ).toEqual({ value: false, source: "account_config" });

    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        skuConfig: null,
        accountConfig: null,
        localSimulation: true
      })
    ).toEqual({ value: true, source: "local_simulation" });
  });

  it("todo null → missing", () => {
    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        skuConfig: null,
        accountConfig: null,
        localSimulation: undefined
      })
    ).toEqual({ value: null, source: "missing" });
  });
});

describe("parsePackageWeightKgFromMl", () => {
  it("rechaza inválidos", () => {
    expect(parsePackageWeightKgFromMl(null)).toBeNull();
    expect(parsePackageWeightKgFromMl(-1)).toBeNull();
    expect(parsePackageWeightKgFromMl(Number.NaN)).toBeNull();
  });

  it("acepta positivo", () => {
    expect(parsePackageWeightKgFromMl(0.5)).toBe(0.5);
  });
});
