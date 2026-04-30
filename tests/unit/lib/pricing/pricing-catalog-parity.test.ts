import { describe, expect, it } from "vitest";
import { buildSkuDecisionState } from "@/lib/pricing/sku-decision-state";
import { computeUnifiedCatalogDerived } from "@/lib/data-v2/unified-catalog";
import type { Database } from "@/lib/supabase/database.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

const ACC = "00000000-0000-4000-8000-aaaaaaaaaaaa";

function samplePricingRow(over: Partial<PricingSkuRow>): PricingSkuRow {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    ml_account_id: ACC,
    sku: "SKU-PARITY",
    producto: "Parity product",
    costo: 12_000,
    peso_kg: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0.08,
    margen_pct: 0.18,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over
  };
}

describe("pricing vs catalog decision parity", () => {
  it("misma ganancia real y precio óptimo para mismos inputs", () => {
    const r = samplePricingRow({});
    const ml = {
      price: 35_000,
      available_quantity: 20,
      status: "active",
      pricing_sku_id: r.id,
      seller_custom_field: r.sku,
      item_id: "MLA-PARITY-1",
      sold_quantity: 5,
      ventas_30d: 24,
      title: r.producto,
      thumbnail: null,
      permalink: "https://example.com",
      revenue_30d: 100,
      last_sale_date: null,
      logistic_type: "fulfillment"
    };
    const u = computeUnifiedCatalogDerived(ACC, ml, r);

    const pricingDecision = buildSkuDecisionState({
      accountId: ACC,
      ml: {
        itemId: ml.item_id,
        sku: r.sku,
        title: r.producto,
        currentPrice: ml.price,
        stock: ml.available_quantity,
        ventas30d: ml.ventas_30d,
        revenue30d: ml.revenue_30d,
        lastSaleDate: ml.last_sale_date,
        shippingMode: ml.logistic_type,
        imageUrl: ml.thumbnail
      },
      inputs: {
        productCost: r.costo,
        logistics: r.logistica,
        publicidadPct: r.publicidad_pct ?? undefined,
        targetMarginPct: r.margen_pct ?? undefined,
        reputacion: r.reputacion,
        pesoKg: r.peso_kg
      }
    });

    expect(pricingDecision.computed.realProfit).toBe(u.decisionState.computed.realProfit);
    expect(pricingDecision.computed.optimalPrice).toBe(u.decisionState.computed.optimalPrice);
  });
});
