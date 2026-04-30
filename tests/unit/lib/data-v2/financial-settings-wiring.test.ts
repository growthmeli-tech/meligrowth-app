import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeEach } from "vitest";
import { computeUnifiedCatalogDerived } from "@/lib/data-v2/unified-catalog";
import type { Database } from "@/lib/supabase/database.types";
import { resetDecisionStateCacheForTests } from "@/lib/pricing/decision-state-cache";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

const ML_ACCOUNT = "00000000-0000-4000-8000-000000000099";

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

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(relFromTests: string): string {
  return readFileSync(join(__dirname, relFromTests), "utf8");
}

describe("account financial settings wiring", () => {
  beforeEach(() => {
    resetDecisionStateCacheForTests();
  });

  it("null account settings keeps calculation partial when cost exists (IIBB/tax missing)", () => {
    const ml = {
      price: 30_000,
      available_quantity: 12,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA-FIS",
      sold_quantity: 0,
      ventas_30d: 4,
      title: "T"
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}), null);
    expect(d.decisionState.sync.calculationStatus).toBe("partial");
    expect(d.decisionState.computed.profitCompleteness).toBe("net_partial");
  });

  it("explicit iibbPct = 0 and taxPct = 0 yields net_full", () => {
    const ml = {
      price: 30_000,
      available_quantity: 12,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA-FIS2",
      sold_quantity: 0,
      ventas_30d: 4,
      title: "T"
    };
    const fs = {
      iibbPct: 0,
      taxPct: 0,
      internalLogisticsCost: null as number | null,
      additionalCostsPct: null as number | null,
      additionalCostsFixed: null as number | null
    };
    const d = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}), fs);
    expect(d.decisionState.computed.profitCompleteness).toBe("net_full");
    expect(d.decisionState.sync.calculationStatus).not.toBe("partial");
  });

  it("iibbPct and taxPct reduce net vs zero-tax baseline", () => {
    const ml = {
      price: 40_000,
      available_quantity: 5,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id: "MLA-TAX",
      sold_quantity: 0,
      ventas_30d: 2,
      title: "T"
    };
    const zero = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}), {
      iibbPct: 0,
      taxPct: 0,
      internalLogisticsCost: null,
      additionalCostsPct: null,
      additionalCostsFixed: null
    });
    const taxed = computeUnifiedCatalogDerived(ML_ACCOUNT, ml, basePricing({}), {
      iibbPct: 0.02,
      taxPct: 0.03,
      internalLogisticsCost: null,
      additionalCostsPct: null,
      additionalCostsFixed: null
    });
    expect(taxed.ganancia_real).not.toBeNull();
    expect(zero.ganancia_real).not.toBeNull();
    expect((taxed.ganancia_real as number) < (zero.ganancia_real as number)).toBe(true);
  });

  it("client ops components do not import financial-settings.server", () => {
    const paths = [
      "../../../../components/catalog/catalog-command-center.tsx",
      "../../../../components/pricing/pricing-engine-table.tsx",
      "../../../../components/pricing/account-fiscal-config-panel.tsx"
    ];
    for (const p of paths) {
      const src = readSrc(p);
      expect(src).not.toMatch(/financial-settings\.server/);
    }
  });
});
