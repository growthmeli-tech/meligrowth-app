import { describe, expect, it } from "vitest";
import { parseMargenesCostosRows } from "@/lib/ingestion/parsers/parse-margenes-costos";

const get = (row: Record<string, unknown>, f: string) => row[f];

describe("parseMargenesCostosRows", () => {
  it("normaliza publicidad 15 → 0.15", () => {
    const r = parseMargenesCostosRows(
      [{ producto: "A", costo: 1000, publicidad_pct: 15, margen_pct: 20, logistica: "flex" }],
      get
    );
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0]?.publicidad_pct).toBeCloseTo(0.15);
    expect(r.valid[0]?.margen_pct).toBeCloseTo(0.2);
    expect(r.valid[0]?.selling).toBeDefined();
    expect(r.valid[0]?.selling?.converged).toBe(true);
  });

  it("usa defaults cuando faltan columnas opcionales", () => {
    const r = parseMargenesCostosRows([{ producto: "X", costo: 5000 }], get);
    expect(r.errors).toHaveLength(0);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0]?.logistica).toBe("Flex");
    expect(r.valid[0]?.reputacion).toBe("Verde / MercadoLíder");
    expect(r.valid[0]?.publicidad_pct).toBeCloseTo(0.1);
    expect(r.valid[0]?.margen_pct).toBeCloseTo(0.15);
    expect(r.valid[0]?.peso_kg).toBeNull();
    expect(r.valid[0]?.selling).toBeDefined();
  });

  it("acepta solo sku (producto derivado del sku)", () => {
    const r = parseMargenesCostosRows([{ sku: "MLA-1", costo: 8000 }], get);
    expect(r.errors).toHaveLength(0);
    expect(r.valid[0]?.producto).toBe("MLA-1");
    expect(r.valid[0]?.sku).toBe("MLA-1");
  });

  it("errors si faltan sku y producto", () => {
    const r = parseMargenesCostosRows([{ producto: "", sku: "", costo: 10 }], get);
    expect(r.valid).toHaveLength(0);
    expect(r.errors.some((e) => e.field === "producto")).toBe(true);
  });
});
