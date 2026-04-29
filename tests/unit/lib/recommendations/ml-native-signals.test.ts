import { describe, expect, it, vi, afterEach } from "vitest";
import { buildMlNativeSignals } from "@/lib/recommendations/ml-native-signals";

const base = {
  diagnosticId: "d1",
  nivel_vendedor: null as string | null,
  ventas_completadas_60d: null as number | null,
  reputacion_real_level: null as string | null,
  reputacion_level_id: null as string | null,
  listings_quota: null as number | null,
  listings_total_items: null as number | null,
  uso_full_flex_pct: null as number | null,
  acos: null as number | null,
  roas: null as number | null,
  margen_pre_ads: null as number | null,
  dias_stock: null as number | null,
  skus_sin_stock_pct: null as number | null,
  ventas_totales: null as number | null
};

describe("buildMlNativeSignals", () => {
  it("2.1 dispara cuando real_level es peor que level_id (protección)", () => {
    const recs = buildMlNativeSignals({
      ...base,
      reputacion_real_level: "1_red",
      reputacion_level_id: "2_green"
    });
    const r = recs.find((x) => x.id.includes("reputacion-protegida"));
    expect(r?.titulo).toBe("Tu reputación real está siendo protegida");
    expect(r?.descripcion).toMatch(/nivel actual/);
  });

  it("2.1 no dispara sin real_level o sin empeoramiento de nivel", () => {
    expect(
      buildMlNativeSignals({ ...base, reputacion_real_level: null, reputacion_level_id: "green" })
    ).toEqual([]);
    expect(
      buildMlNativeSignals({ ...base, reputacion_real_level: "green", reputacion_level_id: "green" })
    ).toEqual([]);
  });

  it("2.2 cupo de publicaciones cuando total_items/quota > 0.85", () => {
    const recs = buildMlNativeSignals({ ...base, listings_quota: 100, listings_total_items: 90 });
    const r = recs.find((x) => x.id.includes("cupo-publicaciones"));
    expect(r?.titulo).toBe("Cupo de publicaciones al límite");
    expect(r?.descripcion).toMatch(/90%|90\/100/);
  });

  it("2.3 Full/Flex crítico con ventas_totales > 100", () => {
    const recs = buildMlNativeSignals({ ...base, uso_full_flex_pct: 40, ventas_totales: 150 });
    const r = recs.find((x) => x.id.includes("full-flex-critico"));
    expect(r?.prioridad).toBe("urgente");
    expect(r?.audiencia).toBe("operator");
  });

  it("2.4 ACOS por encima del break-even 100/margen_pre_ads (margen 30% → 3.33% ACOS)", () => {
    const recs = buildMlNativeSignals({ ...base, margen_pre_ads: 30, acos: 5 });
    const r = recs.find((x) => x.id.includes("breakeven-margen"));
    expect(r).toBeDefined();
    expect(r?.descripcion).toMatch(/3\.33|break-even/i);
  });

  it("2.4 no dispara si ACOS está bajo el break-even", () => {
    const recs = buildMlNativeSignals({ ...base, margen_pre_ads: 30, acos: 3 });
    expect(recs.find((x) => x.id.includes("breakeven-margen"))).toBeUndefined();
  });

  it("2.5 riesgo de quiebre con dias_stock < 15 y skus_sin_stock > 5", () => {
    const recs = buildMlNativeSignals({ ...base, dias_stock: 10, skus_sin_stock_pct: 8 });
    const r = recs.find((x) => x.id.includes("riesgo-quiebre"));
    expect(r?.titulo).toBe("Riesgo de quiebre de stock esta semana");
  });

  it("2.6 potencial Mercado Línder sin power_seller y con ventas > 50", () => {
    const recs = buildMlNativeSignals({ ...base, ventas_completadas_60d: 60, nivel_vendedor: null });
    const r = recs.find((x) => x.id.includes("mercado-lider-candidato"));
    expect(r?.prioridad).toBe("media");
    expect(r?.titulo).toBe("A un paso de ser Mercado Líder");
  });
});
