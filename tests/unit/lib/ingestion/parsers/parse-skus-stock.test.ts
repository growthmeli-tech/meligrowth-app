import { describe, expect, it } from "vitest";
import { parseSkusStockRows } from "@/lib/ingestion/parsers/parse-skus-stock";

describe("parseSkusStockRows", () => {
  it("normaliza y valida filas correctas", () => {
    const r = parseSkusStockRows([{ sku: "A1", producto: "P", stock: 5, dias_stock: 10 }]);
    expect(r.valid).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
    expect(r.valid[0]).toMatchObject({ stock: 5, dias_stock: 10 });
  });
  it("errores por columna faltante y negativo", () => {
    const r = parseSkusStockRows([
      { sku: "", producto: "P", stock: 1, dias_stock: null },
      { sku: "A", producto: "P", stock: -1, dias_stock: null }
    ]);
    expect(r.valid.length).toBe(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("rechaza SKU duplicado", () => {
    const r = parseSkusStockRows([
      { sku: "X", producto: "a", stock: 1, dias_stock: null },
      { sku: "X", producto: "b", stock: 2, dias_stock: null }
    ]);
    expect(r.valid).toHaveLength(1);
    expect(r.errors.some((e) => e.message.includes("Duplicado"))).toBe(true);
  });
});
