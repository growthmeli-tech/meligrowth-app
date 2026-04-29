import { describe, expect, it } from "vitest";
import { parseFichaTecnicaRows } from "@/lib/ingestion/parsers/parse-ficha-tecnica";

const get = (row: Record<string, unknown>, f: string) => row[f];

describe("parseFichaTecnicaRows", () => {
  it("importa título requerido", () => {
    const r = parseFichaTecnicaRows([{ sku: "s", titulo: "T" }], get);
    expect(r.valid).toHaveLength(1);
  });
  it("parsea atributos pipe", () => {
    const r = parseFichaTecnicaRows([{ sku: "s", titulo: "T", atributos: "color: rojo|marca: x" }], get);
    expect((r.valid[0]?.atributos as { color: string })?.color).toBe("rojo");
  });
});
