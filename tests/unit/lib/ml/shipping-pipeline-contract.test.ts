import { describe, expect, it } from "vitest";
import { hasVerifiedFlexSignal, normalizeMlShipping } from "@/lib/ml/normalize-ml-shipping";
import { parseMlCatalogApiItemBody } from "@/lib/ml/endpoints/catalog";
import { estimateSellerShippingCostAr } from "@/lib/pricing/shipping-costs-argentina";
import { buildPricingRowInput } from "@/lib/pricing/pricing-row-model";
import { buildSkuDecisionState } from "@/lib/pricing/sku-decision-state";

describe("normalizeMlShipping", () => {
  it("fulfillment + free true => Full gratis", () => {
    const n = normalizeMlShipping({
      logistic_type: "fulfillment",
      mode: "me2",
      free_shipping: true,
      free_shipping_key_present: true
    });
    expect(n.shippingMode).toBe("full");
    expect(n.label).toBe("Full gratis");
  });

  it("self_service + free false => Flex", () => {
    const n = normalizeMlShipping({
      logistic_type: "self_service",
      mode: null,
      free_shipping: false,
      free_shipping_key_present: true
    });
    expect(n.shippingMode).toBe("flex");
    expect(n.label).toBe("Flex");
  });

  it("drop_off sin señal Flex => modo me2 y etiqueta Mercado Envíos gratis", () => {
    const n = normalizeMlShipping({
      logistic_type: "drop_off",
      mode: "me2",
      free_shipping: true,
      free_shipping_key_present: true,
      tags: [],
      methods: []
    });
    expect(n.shippingMode).toBe("me2");
    expect(n.label).toBe("Mercado Envíos gratis");
    expect(n.label).not.toMatch(/ME2/i);
    expect(n.reasons).toContain("no_flex_specific_signal");
  });

  it("no inventa Flex desde drop_off aunque haya ruido en tags no self_service", () => {
    const n = normalizeMlShipping({
      logistic_type: "drop_off",
      mode: "me2",
      free_shipping: false,
      free_shipping_key_present: true,
      tags: ["unknown_tag"],
      methods: []
    });
    expect(n.shippingMode).toBe("me2");
  });

  it("free_shipping key ausente => freeShipping null", () => {
    const n = normalizeMlShipping({
      logistic_type: "drop_off",
      mode: "me2",
      free_shipping_key_present: false
    });
    expect(n.freeShipping).toBeNull();
  });

  it("hasVerifiedFlexSignal detecta self_service en methods", () => {
    expect(hasVerifiedFlexSignal([], [{ logistic_type: "self_service" }])).toBe(true);
  });
});

describe("shipping pipeline contract (raw-like fixtures)", () => {
  it("parser conserva free_shipping true", () => {
    const body = {
      id: "MLA123",
      title: "x",
      price: 100,
      available_quantity: 1,
      sold_quantity: 0,
      status: "active",
      condition: "new",
      shipping: { mode: "me2", logistic_type: "drop_off", free_shipping: true, tags: [], methods: [] }
    };
    const p = parseMlCatalogApiItemBody(body as Record<string, unknown>);
    expect(p?.free_shipping).toBe(true);
    expect(p?.free_shipping_key_present).toBe(true);
  });

  it("free_shipping false => sellerShippingCost 0 en estimación AR", () => {
    const e = estimateSellerShippingCostAr({
      price: 30_000,
      packageWeightKg: 0.4,
      reputation: "yellow",
      shippingMode: "me2",
      freeShipping: false,
      condition: "new",
      accountReputationSynced: true
    });
    expect(e.sellerShippingCost).toBe(0);
  });

  it("pricing row input usa shipping_mode ML sin mezclar logistic_type en shippingMode", () => {
    const ml = {
      item_id: "MLA1",
      permalink: null,
      stock: 1,
      price_ml: 100,
      logistic_type: "drop_off",
      shipping_mode: "me2",
      free_shipping: true,
      condition: "new",
      package_weight_kg: 0.4,
      shipping_tags: [],
      shipping_methods: []
    };
    const row = {
      id: "ps1",
      sku: "S",
      producto: "P",
      costo: 10,
      logistica: "Flex" as const,
      publicidad_pct: 0,
      margen_pct: 0.2,
      reputacion: null,
      peso_kg: null,
      ml_account_id: "a",
      ml_item_id: "MLA1",
      ganancia_unit: null,
      roi: null,
      precio_venta: null,
      source_file: null,
      free_shipping: null,
      created_at: "",
      updated_at: ""
    };
    const input = buildPricingRowInput("acc", row as never, { costo: 10, logistica: "Flex", publicidad_pct: 0, margen_pct: 0.2 }, ml);
    expect(input.ml.shippingMode).toBe("me2");
    expect(input.ml.logisticType).toBe("drop_off");
  });

  it("4_light_green + cuenta sync no dispara mensaje Falta reputación ML de cuenta", () => {
    const s = buildSkuDecisionState({
      accountId: "acc",
      accountReputation: {
        sellerReputationLevel: "4_light_green",
        sellerPowerSellerStatus: null,
        sellerReputationSyncedAt: "2026-01-01T00:00:00.000Z"
      },
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      ml: {
        itemId: "MLA1",
        title: "P",
        sku: "S",
        currentPrice: 40_000,
        stock: 10,
        ventas30d: 5,
        freeShipping: true,
        shippingMode: "me2",
        logisticType: "drop_off",
        packageWeightKg: 0.4,
        condition: "new"
      },
      inputs: {
        reputacion: "Verde / MercadoLíder",
        productCost: 10_000,
        logistics: "Flex",
        publicidadPct: 0,
        targetMarginPct: 0.2
      }
    });
    expect(s.businessDecision.message).not.toBe("Falta reputación ML de cuenta");
  });
});
