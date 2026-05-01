import { describe, expect, it, beforeEach } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  selectFilteredPricingRowIds,
  selectHeaderMetrics,
  selectVisiblePricingRows
} from "@/lib/pricing/pricing-engine-selectors";
import { rowToDraft, makeDraftImpactKey } from "@/lib/pricing/pricing-row-model";
import { resetDecisionStateCacheForTests } from "@/lib/pricing/decision-state-cache";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

const ACC = "00000000-0000-4000-8000-aaaaaaaaaaaa";

function samplePricingRow(over: Partial<PricingSkuRow>): PricingSkuRow {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    ml_account_id: ACC,
    sku: "SKU-PARITY",
    producto: "Parity product",
    costo: 12_000,
    ml_item_id: null,
    peso_kg: null,
    logistica: "Flex",
    reputacion: "Verde / MercadoLíder",
    publicidad_pct: 0.08,
    margen_pct: 0.18,
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

describe("pricing-engine-selectors", () => {
  beforeEach(() => {
    resetDecisionStateCacheForTests();
  });

  it("selectFilteredPricingRowIds returns ids only", () => {
    const r1 = samplePricingRow({ id: "00000000-0000-4000-8000-000000000001", sku: "x" });
    const r2 = samplePricingRow({ id: "00000000-0000-4000-8000-000000000002", sku: "y", costo: 200 });
    const rows = [r1, r2];
    const drafts = { [r1.id]: rowToDraft(r1), [r2.id]: rowToDraft(r2) };
    const ids = selectFilteredPricingRowIds(rows, (id) => drafts[id], undefined, {}, ACC, null, "", "all");
    expect(ids).toContain(r1.id);
    expect(ids).toContain(r2.id);
  });

  it("selectVisiblePricingRows maps ids through rowsById", () => {
    const r1 = samplePricingRow({ id: "1" });
    const r2 = samplePricingRow({ id: "2" });
    const m = new Map([
      ["1", r1],
      ["2", r2]
    ]);
    expect(selectVisiblePricingRows(m, ["2"])).toEqual([r2]);
  });

  it("selectHeaderMetrics returns stable-shaped aggregates", () => {
    const r = samplePricingRow({});
    const rows = [r];
    const drafts = { [r.id]: rowToDraft(r) };
    const m = selectHeaderMetrics(rows, (id) => drafts[id], undefined, {}, ACC, null);
    expect(m.weightedMargenObj).not.toBeNull();
    expect(typeof m.weightedReal === "number" || m.weightedReal === null).toBe(true);
  });
});

describe("makeDraftImpactKey", () => {
  it("same draft content yields same key even with new drafts object", () => {
    const r = samplePricingRow({});
    const rows = [r];
    const d1: Record<string, ReturnType<typeof rowToDraft>> = { [r.id]: rowToDraft(r) };
    const d2 = { ...d1 };
    expect(makeDraftImpactKey(rows, d1)).toBe(makeDraftImpactKey(rows, d2));
  });

  it("changes when a draft field changes", () => {
    const r = samplePricingRow({});
    const base = rowToDraft(r);
    const a = { [r.id]: base };
    const b = { [r.id]: { ...base, costo: (base.costo ?? 0) + 1 } };
    expect(makeDraftImpactKey([r], a)).not.toBe(makeDraftImpactKey([r], b));
  });
});
