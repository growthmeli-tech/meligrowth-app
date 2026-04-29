import { describe, expect, it } from "vitest";
import { detectTemplateType } from "@/lib/ingestion/template-detector";

describe("detectTemplateType", () => {
  it("detecta pricing comercial", () => {
    const h = ["Plan", "current_revenue", "projected_revenue", "gross_margin_pct", "delivery_cost", "months"];
    expect(detectTemplateType(h)).toBe("pricing_comercial");
  });
  it("detecta skus y stock con columnas requeridas", () => {
    const h = ["sku", "producto", "stock", "dias_stock"];
    expect(detectTemplateType(h)).toBe("skus_stock");
  });
  it("detecta márgenes con producto + costo", () => {
    const h = ["producto", "costo", "publicidad"];
    expect(detectTemplateType(h)).toBe("margenes_costos");
  });
  it("detecta márgenes con sku | costo | precio | margen", () => {
    expect(detectTemplateType(["sku", "costo", "precio", "margen"])).toBe("margenes_costos");
  });
  it("detecta márgenes con sku + costo mínimo", () => {
    expect(detectTemplateType(["sku", "costo"])).toBe("margenes_costos");
  });
  it("detecta márgenes con producto + costo + logística", () => {
    expect(detectTemplateType(["producto", "costo", "logistica"])).toBe("margenes_costos");
  });
  it("detecta ficha técnica (titulo, sin stock)", () => {
    const h = ["sku", "titulo", "descripcion"];
    expect(detectTemplateType(h)).toBe("ficha_tecnica");
  });
  it("retorna unknown si no matchea", () => {
    expect(detectTemplateType(["foo", "bar"])).toBe("unknown");
  });
});
