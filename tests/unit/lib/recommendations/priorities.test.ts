import { describe, expect, it } from "vitest";
import { getPrioridadRecomendacion, sortByPriority } from "@/lib/recommendations/priorities";

describe("Prioridades de recomendaciones", () => {
  it("salud critica es urgente", () => {
    expect(getPrioridadRecomendacion("critico", "salud")).toBe("urgente");
    expect(getPrioridadRecomendacion("en_riesgo", "salud")).toBe("urgente");
  });

  it("ads critico es urgente", () => {
    expect(getPrioridadRecomendacion("critico", "ads")).toBe("urgente");
  });

  it("ordena items por prioridad de mayor a menor urgencia", () => {
    const sorted = sortByPriority([
      { id: "1", prioridad: "media" as const },
      { id: "2", prioridad: "urgente" as const },
      { id: "3", prioridad: "alta" as const },
      { id: "4", prioridad: "baja" as const }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["2", "3", "1", "4"]);
  });
});
