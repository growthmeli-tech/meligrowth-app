import { describe, expect, it } from "vitest";
import { resolveFreeShippingProvenance, parsePackageWeightKgFromMl, formatMlLogisticsPublicationLabel } from "@/lib/pricing/ml-official-data-contract";

describe("resolveFreeShippingProvenance", () => {
  it("ML boolean gana sobre simulación", () => {
    const r = resolveFreeShippingProvenance({
      mlApi: true,
      localSimulation: false
    });
    expect(r).toEqual({ value: true, source: "ml_api" });
  });

  it("sin ML boolean, aplica solo simulación explícita", () => {
    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        localSimulation: true
      })
    ).toEqual({ value: true, source: "local_simulation" });

    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        localSimulation: false
      })
    ).toEqual({ value: false, source: "local_simulation" });
  });

  it("simulación explícita null (operador: sin dato) → local_simulation partial", () => {
    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
        localSimulation: null
      })
    ).toEqual({ value: null, source: "local_simulation" });
  });

  it("sin ML ni simulación → missing", () => {
    expect(
      resolveFreeShippingProvenance({
        mlApi: null,
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

describe("formatMlLogisticsPublicationLabel", () => {
  it("arma etiqueta desde columnas crudas ML", () => {
    expect(
      formatMlLogisticsPublicationLabel({
        logistic_type: "fulfillment",
        shipping_mode: "me2",
        free_shipping: true
      })
    ).toBe("Full gratis");
    expect(
      formatMlLogisticsPublicationLabel({
        logistic_type: "self_service",
        shipping_mode: null,
        free_shipping: false
      })
    ).toBe("Flex");
  });

  it("me2 nunca expone ME2 en etiqueta publicación", () => {
    const s = formatMlLogisticsPublicationLabel({
      logistic_type: "xd_drop_off",
      shipping_mode: "me2",
      free_shipping: false,
      free_shipping_key_present: true
    });
    expect(s).toBe("Mercado Envíos");
    expect(s).not.toMatch(/ME2/i);
  });

  it("custom => A coordinar", () => {
    expect(
      formatMlLogisticsPublicationLabel({
        logistic_type: "custom",
        shipping_mode: null,
        free_shipping: false,
        free_shipping_key_present: true
      })
    ).toBe("A coordinar");
  });
});
