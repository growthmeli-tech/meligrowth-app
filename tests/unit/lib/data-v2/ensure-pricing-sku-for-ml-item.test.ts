import { describe, expect, it } from "vitest";
import { findReusableCostPricingSku } from "@/lib/data-v2/ensure-pricing-sku-for-ml-item";

function row(
  over: Partial<{ id: string; sku: string | null; costo: number | null; ml_item_id: string | null; source_file: string | null }>
) {
  return {
    id: "sku-1",
    sku: "ABC-1",
    costo: 1500,
    ml_item_id: null,
    source_file: "company/file.xlsx",
    ...over
  };
}

describe("findReusableCostPricingSku", () => {
  it("matches Excel SKU to seller_custom_field and ignores empty shells", () => {
    const found = findReusableCostPricingSku(
      { item_id: "MLA123", seller_custom_field: "ABC-1" },
      [
        row({ id: "shell", sku: "MLA123", costo: null, ml_item_id: "MLA123", source_file: "ml_item_shell" }),
        row({ id: "excel", sku: "ABC-1", costo: 2200, source_file: "co/ts-margenes.xlsx" })
      ]
    );
    expect(found?.id).toBe("excel");
  });

  it("matches Excel SKU to ML item_id when custom field is empty", () => {
    const found = findReusableCostPricingSku(
      { item_id: "MLA999", seller_custom_field: null },
      [row({ id: "excel-mla", sku: "MLA999", costo: 800 })]
    );
    expect(found?.id).toBe("excel-mla");
  });

  it("does not reuse zero or null cost rows", () => {
    const found = findReusableCostPricingSku(
      { item_id: "MLA1", seller_custom_field: "S1" },
      [
        row({ id: "zero", sku: "S1", costo: 0 }),
        row({ id: "empty", sku: "S1", costo: null })
      ]
    );
    expect(found).toBeNull();
  });

  it("first SKU with cost wins when duplicates exist", () => {
    const found = findReusableCostPricingSku(
      { item_id: "MLA1", seller_custom_field: "DUP" },
      [
        row({ id: "newer", sku: "DUP", costo: 10 }),
        row({ id: "older", sku: "DUP", costo: 99 })
      ]
    );
    expect(found?.id).toBe("newer");
  });
});
