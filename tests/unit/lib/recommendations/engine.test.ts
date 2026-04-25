import { describe, expect, it } from "vitest";
import { analyzeAds } from "@/lib/recommendations/ads-analyzer";
import { generateRecommendations } from "@/lib/recommendations/engine";
import type { Database } from "@/lib/supabase/database.types";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

function buildDiagnosticRow(overrides: Partial<DiagnosticRow> = {}): DiagnosticRow {
  return {
    id: "diag-1",
    client_id: "client-1",
    date: "2026-04-25",
    score_global: 58,
    estado_global: "riesgo",
    reclamos: 1.8,
    mediaciones: 0.35,
    cancelaciones_vendedor: 0.4,
    envios_a_tiempo: 87,
    score_salud: 49,
    pubs_activas_pct: 62,
    pubs_optimizadas_pct: 48,
    ctr: 1.2,
    score_publicaciones: 60,
    margen_pre_ads: 30,
    gasto_ads: 200,
    ventas_ads: 900,
    ventas_totales: 5000,
    acos: 22,
    roas: 3,
    tacos: 4,
    score_ads: 52,
    incidencias_pct: 2.2,
    uso_full_flex_pct: 45,
    cancelaciones_stock_pct: 1.4,
    score_logistica: 61,
    skus_sin_stock_pct: 10,
    dias_stock: 12,
    lead_time_reposicion: 12,
    sistema_reposicion: 40,
    score_stock: 57,
    created_by: "user-1",
    source: "manual",
    created_at: "2026-04-25T10:00:00.000Z",
    ...overrides
  };
}

describe("Motor de Recomendaciones", () => {
  describe("generateRecommendations", () => {
    it("genera recomendacion urgente cuando envios a tiempo < 88%", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow({ envios_a_tiempo: 86 }));
      const envios = recommendations.recomendaciones.find((item) => item.metrica_afectada === "envios_a_tiempo");
      expect(envios?.prioridad).toBe("urgente");
    });

    it("no genera recomendacion para metricas en estado Platinum", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow({ reclamos: 0.1, envios_a_tiempo: 99 }));
      expect(recommendations.recomendaciones.some((item) => item.metrica_afectada === "reclamos")).toBe(false);
      expect(recommendations.recomendaciones.some((item) => item.metrica_afectada === "envios_a_tiempo")).toBe(false);
    });

    it("ordena recomendaciones por prioridad, urgentes primero", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow());
      const urgentIndex = recommendations.recomendaciones.findIndex((item) => item.prioridad === "urgente");
      const mediaIndex = recommendations.recomendaciones.findIndex((item) => item.prioridad === "media");
      expect(urgentIndex).toBeGreaterThanOrEqual(0);
      expect(mediaIndex).toBeGreaterThanOrEqual(0);
      expect(urgentIndex).toBeLessThan(mediaIndex);
    });

    it("incluye analisis de ads cuando hay datos de ads", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow());
      expect(recommendations.recomendaciones.some((item) => item.metrica_afectada === "ads_profitability")).toBe(true);
    });

    it("no incluye analisis de ads cuando gasto_ads es null", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow({ gasto_ads: null }));
      expect(recommendations.recomendaciones.some((item) => item.metrica_afectada === "ads_profitability")).toBe(false);
    });

    it("marca como urgente cualquier metrica de Salud en estado critico", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow({ reclamos: 5 }));
      const rec = recommendations.recomendaciones.find((item) => item.metrica_afectada === "reclamos");
      expect(rec?.prioridad).toBe("urgente");
    });
  });

  describe("analyzeAds", () => {
    it("estado CRITICO cuando TACOS > 65% del margen", () => {
      const analysis = analyzeAds({ margen_pre_ads: 30, gasto_ads: 200, ventas_ads: 1000, ventas_totales: 500 });
      expect(analysis.estado_salud).toBe("critico");
    });

    it("estado ESCALABLE cuando ROAS > 6x y TACOS < 13% del margen", () => {
      const analysis = analyzeAds({ margen_pre_ads: 30, gasto_ads: 100, ventas_ads: 1000, ventas_totales: 10000 });
      expect(analysis.estado_salud).toBe("escalable");
    });

    it("estado SIN_DATOS cuando gasto_ads o ventas_ads es 0", () => {
      const analysis = analyzeAds({ margen_pre_ads: 30, gasto_ads: 0, ventas_ads: 0, ventas_totales: 1000 });
      expect(analysis.estado_salud).toBe("sin_datos");
    });

    it("ROAS minimo = 1 / margen_pre_ads", () => {
      const analysis = analyzeAds({ margen_pre_ads: 25, gasto_ads: 100, ventas_ads: 500, ventas_totales: 10000 });
      expect(analysis.roas_minimo).toBeCloseTo(4);
    });

    it("diferencial ROAS positivo = ganas, negativo = perdes", () => {
      const positive = analyzeAds({ margen_pre_ads: 25, gasto_ads: 100, ventas_ads: 700, ventas_totales: 10000 });
      const negative = analyzeAds({ margen_pre_ads: 25, gasto_ads: 100, ventas_ads: 200, ventas_totales: 10000 });
      expect(positive.diferencial_roas).toBeGreaterThan(0);
      expect(negative.diferencial_roas).toBeLessThan(0);
    });
  });

  describe("casos reales de la planilla", () => {
    it("diagnostico v23 con TACOS 66.7% -> estado CRITICO en ads", () => {
      const analysis = analyzeAds({ margen_pre_ads: 30, gasto_ads: 1000, ventas_ads: 1500, ventas_totales: 1500 });
      expect(analysis.estado_salud).toBe("critico");
    });

    it("diagnostico con ROAS 5x y TACOS 4% -> estado SALUDABLE", () => {
      const analysis = analyzeAds({ margen_pre_ads: 30, gasto_ads: 100, ventas_ads: 500, ventas_totales: 2500 });
      expect(analysis.estado_salud).toBe("saludable");
    });

    it("cuenta con reclamos 5% -> recomendacion urgente en Salud", () => {
      const recommendations = generateRecommendations(buildDiagnosticRow({ reclamos: 5 }));
      const rec = recommendations.recomendaciones.find((item) => item.metrica_afectada === "reclamos");
      expect(rec?.categoria).toBe("salud");
      expect(rec?.prioridad).toBe("urgente");
    });
  });
});
