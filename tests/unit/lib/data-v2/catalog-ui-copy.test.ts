import { describe, expect, it } from "vitest";
import { CATALOG_ENVIO_GRATIS_SIMULADO_LABEL } from "@/lib/data-v2/catalog-ui-copy";

describe("catalog-ui-copy", () => {
  it("etiqueta de simulación no implica mutación en Mercado Libre", () => {
    expect(CATALOG_ENVIO_GRATIS_SIMULADO_LABEL.toLowerCase()).toContain("simulado");
    expect(CATALOG_ENVIO_GRATIS_SIMULADO_LABEL.toLowerCase()).not.toContain("mercado libre");
  });
});
