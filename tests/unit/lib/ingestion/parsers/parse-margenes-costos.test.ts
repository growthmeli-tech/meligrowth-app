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
  });
  it("errors si falta producto", () => {
    const r = parseMargenesCostosRows([{ producto: "", costo: 10 }], get);
    expect(r.valid).toHaveLength(0);
    expect(r.errors.some((e) => e.field === "producto")).toBe(true);
  });
});
