import { describe, expect, it } from "vitest";
import { catalogDetailPanelOrderedIds } from "@/lib/data-v2/catalog-detail-panel-ids";

describe("catalogDetailPanelOrderedIds", () => {
  it("incluye filas abiertas aunque el filtro actual las haya excluido", () => {
    const filtered = ["a", "b"];
    const ids = catalogDetailPanelOrderedIds(filtered, null, "c", null, null);
    expect(ids).toEqual(["c"]);
  });

  it("preserva el orden del filtro para ids visibles y agrega el resto al final", () => {
    const filtered = ["x", "y", "z"];
    const ids = catalogDetailPanelOrderedIds(filtered, "z", "x", null, "q");
    expect(ids).toEqual(["x", "z", "q"]);
  });

  it("vacío cuando no hay paneles activos", () => {
    expect(catalogDetailPanelOrderedIds(["a"], null, null, null, null)).toEqual([]);
  });
});
