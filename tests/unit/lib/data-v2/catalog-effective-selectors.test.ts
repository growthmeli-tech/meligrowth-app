import { describe, expect, it, beforeEach } from "vitest";
import { computeUnifiedCatalogDerived } from "@/lib/data-v2/unified-catalog";
import { catalogStateFromItems } from "@/lib/data-v2/catalog-state";
import {
  catalogOrderedEffectiveItems,
  getEffectiveCatalogItem,
  localShippingPolicyOverridesFingerprint
} from "@/lib/data-v2/catalog-effective-row";
import {
  selectCatalogCounts,
  selectCatalogPromMargenEstimado,
  selectCatalogPromMargenReal,
  selectCatalogVisibleRows,
  makeCatalogFilterImpactKey
} from "@/lib/data-v2/catalog-selectors";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import type { Database } from "@/lib/supabase/database.types";
import { resetDecisionStateCacheForTests } from "@/lib/pricing/decision-state-cache";

const ML_ACCOUNT = "00000000-0000-4000-8000-000000000088";
type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

beforeEach(() => {
  resetDecisionStateCacheForTests();
});

function lossyFreeShippingRow(): UnifiedCatalogItem {
  const pricing = {
    id: "psk-loss",
    ml_account_id: ML_ACCOUNT,
    sku: "sku-loss",
    producto: "Prod",
    costo: 24_000,
    ml_item_id: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0,
    margen_pct: 0.15,
    peso_kg: 0.5,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z"
  } as PricingSkuRow;

  const derived = computeUnifiedCatalogDerived(
    ML_ACCOUNT,
    {
      price: 25_000,
      available_quantity: 2,
      status: "active",
      pricing_sku_id: "psk-loss",
      seller_custom_field: null,
      item_id: "item-loss",
      sold_quantity: 0,
      ventas_30d: 5,
      title: "Prod",
      free_shipping: true,
      package_weight_kg: 0.5,
      condition: "new",
      shipping_mode: "fulfillment"
    },
    pricing,
    { iibbPct: 0, taxPct: 0, internalLogisticsCost: 0 },
    {
      sellerReputationLevel: "yellow",
      sellerPowerSellerStatus: null,
      sellerReputationSyncedAt: "2026-01-01T00:00:00.000Z"
    },
    { sellerId: "test-seller" }
  );

  return {
    ml_row_id: "ml-1",
    item_id: "item-loss",
    title: "Prod",
    permalink: null,
    thumbnail: null,
    last_synced_at: "2020-01-01T00:00:00Z",
    seller_custom_field: null,
    logistic_type: "fulfillment",
    ...derived
  };
}

function rowNullMlFreeForSim(): UnifiedCatalogItem {
  const pricing = {
    id: "psk-sim",
    ml_account_id: ML_ACCOUNT,
    sku: "sku-sim",
    producto: "Prod",
    costo: 24_000,
    ml_item_id: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0,
    margen_pct: 0.15,
    peso_kg: 0.5,
    precio_venta: null,
    ganancia_unit: null,
    roi: null,
    source_file: null,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z"
  } as PricingSkuRow;

  const derived = computeUnifiedCatalogDerived(
    ML_ACCOUNT,
    {
      price: 25_000,
      available_quantity: 2,
      status: "active",
      pricing_sku_id: "psk-sim",
      seller_custom_field: null,
      item_id: "item-sim",
      sold_quantity: 0,
      ventas_30d: 5,
      title: "Prod",
      free_shipping: null,
      ml_free_shipping_key_present: true,
      package_weight_kg: 0.5,
      condition: "new",
      shipping_mode: "fulfillment"
    },
    pricing,
    { iibbPct: 0, taxPct: 0, internalLogisticsCost: 0 },
    {
      sellerReputationLevel: "yellow",
      sellerPowerSellerStatus: null,
      sellerReputationSyncedAt: "2026-01-01T00:00:00.000Z"
    },
    { sellerId: "test-seller" }
  );

  return {
    ml_row_id: "ml-sim",
    item_id: "item-sim",
    title: "Prod",
    permalink: null,
    thumbnail: null,
    last_synced_at: "2020-01-01T00:00:00Z",
    seller_custom_field: null,
    logistic_type: "fulfillment",
    ...derived
  };
}

describe("getEffectiveCatalogItem", () => {
  it("sin override devuelve la misma referencia (sin recomputar)", () => {
    const row = lossyFreeShippingRow();
    const eff = getEffectiveCatalogItem(ML_ACCOUNT, row, {}, null);
    expect(eff).toBe(row);
  });

  it("override sim freeShipping no pisa un booleano ML: ML true + sim false sigue en true", () => {
    const row = lossyFreeShippingRow();
    expect(row.decisionState.ml.freeShipping).toBe(true);
    const eff = getEffectiveCatalogItem(ML_ACCOUNT, row, { [row.item_id]: { overrideFreeShipping: false } }, null);
    expect(eff).not.toBe(row);
    expect(eff.decisionState.ml.freeShipping).toBe(true);
  });
});

describe("localShippingPolicyOverridesFingerprint", () => {
  it("es estable por claves ordenadas", () => {
    const a = localShippingPolicyOverridesFingerprint({ b: { overrideFreeShipping: true }, a: { overrideFreeShipping: false } });
    const b = localShippingPolicyOverridesFingerprint({ a: { overrideFreeShipping: false }, b: { overrideFreeShipping: true } });
    expect(a).toBe(b);
  });
});

describe("selectores + fila efectiva", () => {
  it("visible rows: con ML free null, sim false fija freeShipping y fuente local_simulation", () => {
    const row = rowNullMlFreeForSim();
    const state = catalogStateFromItems([row]);
    const ctx = {
      mlAccountId: ML_ACCOUNT,
      financialSettings: null,
      localShippingPolicyOverrides: { [row.item_id]: { overrideFreeShipping: false } }
    };
    const visible = selectCatalogVisibleRows(state, [row.item_id], ctx);
    expect(visible).toHaveLength(1);
    expect(visible[0].decisionState.ml.freeShipping).toBe(false);
    expect(visible[0].decisionState.fieldSources.freeShipping).toBe("local_simulation");
  });

  it("selectCatalogCounts usa fila efectiva (ok puede subir con simulación)", () => {
    const row = rowNullMlFreeForSim();
    const state = catalogStateFromItems([row]);
    const cLoss = selectCatalogCounts(state);
    const cSim = selectCatalogCounts(state, {
      mlAccountId: ML_ACCOUNT,
      financialSettings: null,
      localShippingPolicyOverrides: { [row.item_id]: { overrideFreeShipping: false } }
    });
    expect(cSim).toBeDefined();
    expect(cLoss).toBeDefined();
    expect(cSim.ok).toBeGreaterThanOrEqual(cLoss.ok);
  });

  it("promMargenReal considera override", () => {
    const row = rowNullMlFreeForSim();
    const state = catalogStateFromItems([row]);
    const p0 = selectCatalogPromMargenReal(state);
    const p1 = selectCatalogPromMargenReal(state, {
      mlAccountId: ML_ACCOUNT,
      financialSettings: null,
      localShippingPolicyOverrides: { [row.item_id]: { overrideFreeShipping: false } }
    });
    expect(p0).toBeNull();
    expect(p1).toBeNull();
  });

  it("margen real y estimado quedan nulos cuando cash-in no está completo", () => {
    const row = rowNullMlFreeForSim();
    const state = catalogStateFromItems([row]);
    const real = selectCatalogPromMargenReal(state);
    const estimated = selectCatalogPromMargenEstimado(state);
    expect(real).toBeNull();
    expect(estimated).toBeNull();
  });

  it("catalogOrderedEffectiveItems alinea lista con override", () => {
    const row = rowNullMlFreeForSim();
    const state = catalogStateFromItems([row]);
    const list = catalogOrderedEffectiveItems(state, {
      mlAccountId: ML_ACCOUNT,
      financialSettings: null,
      localShippingPolicyOverrides: { [row.item_id]: { overrideFreeShipping: false } }
    });
    expect(list[0].decisionState.ml.freeShipping).toBe(false);
  });
});

describe("makeCatalogFilterImpactKey", () => {
  it("incluye fingerprint de overrides para invalidar memo de filtros", () => {
    const f = {
      q: "",
      statusFilter: "all",
      logFilter: "all",
      margenFilter: "all",
      costFilter: "all",
      stockFilter: "all",
      activePill: null
    };
    const a = makeCatalogFilterImpactKey(f, "");
    const b = makeCatalogFilterImpactKey(f, "x\x1etrue");
    expect(a).not.toBe(b);
  });
});

describe("getEffectiveCatalogItem — sin side effects de servidor", () => {
  it("solo depende de recompute local (sin importar server actions)", async () => {
    const mod = await import("@/lib/data-v2/catalog-effective-row");
    const src = String(mod.getEffectiveCatalogItem);
    expect(src).not.toMatch(/saveCostForItem|pushOptimalPriceToML|triggerCatalogSync/);
  });
});
