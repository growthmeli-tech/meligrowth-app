import { describe, expect, it } from "vitest";
import { computeUnifiedCatalogDerived } from "@/lib/data-v2/unified-catalog";
import type { Database } from "@/lib/supabase/database.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

function basePricing(over: Partial<PricingSkuRow>): PricingSkuRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    ml_account_id: "00000000-0000-4000-8000-000000000002",
    sku: "TEST",
    producto: "Producto",
    costo: 15_600,
    peso_kg: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0.1,
    margen_pct: 0.15,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over
  };
}

describe("computeUnifiedCatalogDerived", () => {
  it("con price_ml y costo calcula ganancia_real coherente", () => {
    const ml = {
      price: 30_000,
      available_quantity: 12,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA123",
      sold_quantity: 0
    };
    const d = computeUnifiedCatalogDerived(ml, basePricing({}));
    expect(d.ganancia_real).not.toBeNull();
    expect(d.margen_real_pct).not.toBeNull();
    expect(d.ganancia_real).toBeGreaterThan(0);
    expect(d.comision_real).not.toBeNull();
    expect(d.envio_real).not.toBeNull();
    expect(d.publicidad_real).not.toBeNull();
  });

  it("normaliza publicidad_pct = 10 como 10%", () => {
    const ml = {
      price: 30_000,
      available_quantity: 5,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA999",
      sold_quantity: null
    };
    const d = computeUnifiedCatalogDerived(ml, basePricing({ publicidad_pct: 10, margen_pct: 15 }));
    expect(d.publicidad_real).toBeCloseTo(3000, 1);
  });

  it("sin pricing → ganancia_real null, no cero", () => {
    const ml = {
      price: 30_000,
      available_quantity: 1,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA777",
      sold_quantity: null
    };
    const d = computeUnifiedCatalogDerived(ml, null);
    expect(d.tiene_costo).toBe(false);
    expect(d.ganancia_real).toBeNull();
    expect(d.margen_real_pct).toBeNull();
  });
});
