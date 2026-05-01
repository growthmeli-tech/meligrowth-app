import { describe, expect, it } from "vitest";
import { computeUnifiedCatalogDerived, orderPricingSkusByUnifiedCatalog } from "@/lib/data-v2/unified-catalog";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import type { Database } from "@/lib/supabase/database.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

const ML_ACCOUNT = "00000000-0000-4000-8000-000000000099";

function basePricing(over: Partial<PricingSkuRow>): PricingSkuRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    ml_account_id: "00000000-0000-4000-8000-000000000002",
    sku: "TEST",
    producto: "Producto",
    costo: 15_600,
    ml_item_id: null,
    peso_kg: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0.1,
    margen_pct: 0.15,
    free_shipping: null,
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
  it("con price_ml y costo sin fiscal deja ganancia_real en null por contrato estricto", () => {
    const ml = {
      price: 30_000,
      available_quantity: 12,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA123",
      sold_quantity: 0,
      ventas_30d: null as number | null,
      title: "T",
      free_shipping: false
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}));
    expect(d.ganancia_real).toBeNull();
    expect(d.cuenta_reputacion_ml).toBe("falta reputación ML");
    expect(d.margen_real_pct).toBeNull();
    expect(d.comision_real).toBeNull();
    expect(d.envio_real).toBeNull();
    expect(d.publicidad_real).toBeNull();
    expect(d.decisionState.computed.realProfit).toBeNull();
  });

  it("normaliza publicidad_pct = 10 como 10%", () => {
    const ml = {
      price: 30_000,
      available_quantity: 5,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA999",
      sold_quantity: null,
      ventas_30d: null as number | null,
      title: "T"
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({ publicidad_pct: 10, margen_pct: 15 }));
    expect(d.publicidad_real).toBeNull();
  });

  it("sin pricing → ganancia_real null, no cero", () => {
    const ml = {
      price: 30_000,
      available_quantity: 1,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA777",
      sold_quantity: null,
      ventas_30d: null as number | null,
      title: "T"
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, null);
    expect(d.tiene_costo).toBe(false);
    expect(d.ganancia_real).toBeNull();
    expect(d.margen_real_pct).toBeNull();
  });

  it("margen_pct null → sin precio_calculado", () => {
    const ml = {
      price: 25_000,
      available_quantity: 3,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA-NM",
      sold_quantity: 0,
      ventas_30d: 10,
      title: "T"
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({ margen_pct: null as unknown as number }));
    expect(d.precio_calculado).toBeNull();
    expect(d.decisionState.computed.optimalPrice).toBeNull();
  });

  it("ventas_30d null → stock syncing en decisionState", () => {
    const ml = {
      price: 20_000,
      available_quantity: 5,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA-SYNC",
      sold_quantity: 0,
      ventas_30d: null,
      title: "T"
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}));
    expect(d.decisionState.decision.stockStatus).toBe("syncing");
    expect(d.stock_status).toBeNull();
  });
});

describe("orderPricingSkusByUnifiedCatalog", () => {
  it("incluye fila por ml_item_id aunque pricing_sku_id del unified sea null", () => {
    const shell = basePricing({ id: "shell-1", ml_item_id: "MLA777" });
    const unifiedStub = [{ item_id: "MLA777", pricing_sku_id: null }] as unknown as UnifiedCatalogItem[];
    const ordered = orderPricingSkusByUnifiedCatalog(unifiedStub, [shell]);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].id).toBe("shell-1");
  });

  it("no duplica la misma fila pricing", () => {
    const shell = basePricing({ id: "shell-2", ml_item_id: "MLA888" });
    const unifiedStub = [
      { item_id: "MLA888", pricing_sku_id: "shell-2" },
      { item_id: "MLA888", pricing_sku_id: "shell-2" }
    ] as unknown as UnifiedCatalogItem[];
    const ordered = orderPricingSkusByUnifiedCatalog(unifiedStub, [shell]);
    expect(ordered).toHaveLength(1);
  });
});
