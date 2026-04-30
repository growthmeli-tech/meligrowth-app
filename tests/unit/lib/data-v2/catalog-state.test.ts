import { describe, expect, it } from "vitest";
import { computeUnifiedCatalogDerived, type UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import {
  catalogOrderedItems,
  catalogStateFromItems,
  reconcileItem,
  reconcileItemReplace,
  reconcileItemReplaces,
  reconcileItems
} from "@/lib/data-v2/catalog-state";

const ML_ACCOUNT = "00000000-0000-4000-8000-000000000099";

function fakeItem(item_id: string, title: string): UnifiedCatalogItem {
  const derived = computeUnifiedCatalogDerived(
    ML_ACCOUNT,
    {
      price: 10_000,
      available_quantity: 3,
      status: "active",
      pricing_sku_id: null,
      seller_custom_field: null,
      item_id,
      sold_quantity: 0,
      ventas_30d: 1,
      title
    },
    null
  );
  return {
    ml_row_id: `mid-${item_id}`,
    item_id,
    title,
    permalink: null,
    thumbnail: null,
    last_synced_at: "2020-01-01T00:00:00.000Z",
    seller_custom_field: null,
    logistic_type: "Flex",
    ...derived
  };
}

describe("catalog-state reconciliation", () => {
  it("reconcileItem leaves untouched row references and stable order", () => {
    const a = fakeItem("a", "A");
    const b = fakeItem("b", "B");
    const state = catalogStateFromItems([a, b]);
    const next = reconcileItem(state, "a", { title: "A2" });
    expect(next.itemsById["b"]).toBe(state.itemsById["b"]);
    expect(next.itemsById["a"]).not.toBe(state.itemsById["a"]);
    expect(next.itemsById["a"].title).toBe("A2");
    expect(next.orderedIds).toEqual(["a", "b"]);
    expect(next.orderedIds).toBe(state.orderedIds);
  });

  it("reconcileItem returns same state when patch is shallow-equal", () => {
    const a = fakeItem("a", "A");
    const state = catalogStateFromItems([a]);
    const next = reconcileItem(state, "a", { title: "A" });
    expect(next).toBe(state);
  });

  it("reconcileItems batches patches with single itemsById shell", () => {
    const a = fakeItem("a", "A");
    const b = fakeItem("b", "B");
    const state = catalogStateFromItems([a, b]);
    const next = reconcileItems(state, { a: { title: "A1" }, b: { title: "B1" } });
    expect(next.itemsById["a"]).not.toBe(a);
    expect(next.itemsById["b"]).not.toBe(b);
    expect(catalogOrderedItems(next).map((r) => r.title)).toEqual(["A1", "B1"]);
  });

  it("reconcileItemReplace swaps one row reference", () => {
    const a = fakeItem("a", "A");
    const b = fakeItem("b", "B");
    const state = catalogStateFromItems([a, b]);
    const a2 = { ...a, title: "A*" };
    const next = reconcileItemReplace(state, a2);
    expect(next.itemsById["b"]).toBe(b);
    expect(next.itemsById["a"]).toBe(a2);
  });

  it("reconcileItemReplaces only changes listed rows", () => {
    const a = fakeItem("a", "A");
    const b = fakeItem("b", "B");
    const c = fakeItem("c", "C");
    const state = catalogStateFromItems([a, b, c]);
    const next = reconcileItemReplaces(state, [{ ...a, title: "A*" }]);
    expect(next.itemsById["b"]).toBe(b);
    expect(next.itemsById["c"]).toBe(c);
    expect(next.itemsById["a"].title).toBe("A*");
  });
});
