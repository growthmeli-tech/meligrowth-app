import { describe, expect, it } from "vitest";
import { calcWeeklyDelta, selectTopWeeklyActions, weeklyScorePhrase } from "@/lib/reports/weekly-report";
import { buildDiagnosticInputFromScraping, hasRequiredScrapingBlocks } from "@/lib/diagnostics/scraping-input";
import { addScoreDeltas, filterHistoryByPeriod, getCurrentAndPreviousHistory, normalizeHistoryPeriod } from "@/lib/history";
import { calculatePricing, comparePricingPlans, getPricingSignals, normalizePricingPlan, selectRecommendedPricingPlan, toNumber } from "@/lib/pricing";
import { parsePricingTemplate } from "@/lib/pricing-template";
import { generateScoreAlerts, isStaleDiagnostic } from "@/lib/score-alerts";
import { calcScore, calcScoreGlobal, getEstado, scoreDiagnostic } from "@/lib/scoring";
import { getRuntimeReadiness, isParserPipelineConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/config";

describe("scoring engine", () => {
  it("maps score states using the platform thresholds", () => {
    expect(getEstado(96)).toBe("platinum");
    expect(getEstado(85)).toBe("solido");
    expect(getEstado(70)).toBe("desarrollo");
    expect(getEstado(55)).toBe("riesgo");
    expect(getEstado(54)).toBe("critico");
  });

  it("scores higher-is-better and lower-is-better metrics", () => {
    expect(calcScore("envios_a_tiempo", 99)).toBe(100);
    expect(calcScore("envios_a_tiempo", 85)).toBe(56);
    expect(calcScore("reclamos", 0.2)).toBe(100);
    expect(calcScore("reclamos", 4)).toBe(56);
  });

  it("calculates weighted global score exactly", () => {
    expect(calcScoreGlobal({ salud: 80, publicaciones: 70, ads: 90, logistica: 60, stock: 100 })).toBe(79);
  });

  it("caps ads when acos is not profitable against pre ads margin", () => {
    const diagnostic = scoreDiagnostic({
      salud: { reclamos: 0.2, mediaciones: 0.1, cancelaciones_vendedor: 0.2, envios_a_tiempo: 99 },
      publicaciones: { pubs_activas_pct: 95, pubs_optimizadas_pct: 90, ctr: 4 },
      ads: { margen_pre_ads: 30, gasto_ads: 100, ventas_ads: 1000, ventas_totales: 2000, acos: 20, roas: 10, tacos: 5 },
      logistica: { incidencias_pct: 1, uso_full_flex_pct: 85, cancelaciones_stock_pct: 0.5 },
      stock: { skus_sin_stock_pct: 3, dias_stock: 30, lead_time_reposicion: 3, sistema_reposicion: 90 }
    });

    expect(diagnostic.scores.ads).toBeLessThanOrEqual(55);
  });

  it("creates score degradation and critical block alerts", () => {
    const alerts = generateScoreAlerts({
      clientName: "Tienda Pampa",
      previous: {
        scoreGlobal: 82,
        scores: { salud: 82, publicaciones: 82, ads: 82, logistica: 82, stock: 82 }
      },
      current: {
        scoreGlobal: 69,
        scores: { salud: 54, publicaciones: 80, ads: 72, logistica: 66, stock: 88 }
      }
    });

    expect(alerts.map((alert) => alert.tipo)).toEqual(["score_bajo", "alerta_critica"]);
  });

  it("detects stale diagnostics after seven days", () => {
    expect(isStaleDiagnostic("2026-04-01", new Date("2026-04-09T12:00:00Z"))).toBe(true);
    expect(isStaleDiagnostic("2026-04-05", new Date("2026-04-09T12:00:00Z"))).toBe(false);
  });

  it("summarizes weekly report deltas and top actions", () => {
    expect(calcWeeklyDelta({ scoreGlobal: 77, date: "2026-04-22" }, { scoreGlobal: 82, date: "2026-04-15" })).toBe(-5);
    expect(weeklyScorePhrase(52)).toContain("crítico");
    expect(
      selectTopWeeklyActions([
        { prioridad: "media", estado: "pendiente", titulo: "Media", descripcion: "" },
        { prioridad: "urgente", estado: "pendiente", titulo: "Urgente", descripcion: "" },
        { prioridad: "alta", estado: "completada", titulo: "Completada", descripcion: "" }
      ]).map((action) => action.titulo)
    ).toEqual(["Urgente", "Media"]);
  });

  it("builds diagnostic input from scraping job results", () => {
    const results = [
      { tipo: "salud", metrics: { reclamos: 1, mediaciones: 0.2, cancelaciones_vendedor: 0.5, envios_a_tiempo: 97 } },
      { tipo: "publicaciones", metrics: { pubs_activas_pct: 90, pubs_optimizadas_pct: 82, ctr: 3 } },
      { tipo: "ads", metrics: { margen_pre_ads: 30, gasto_ads: 100, ventas_ads: 1000, ventas_totales: 2000, acos: 10, roas: 8, tacos: 5 } },
      { tipo: "stock", metrics: { incidencias_pct: 2, uso_full_flex_pct: 70, cancelaciones_stock_pct: 1, skus_sin_stock_pct: 7, dias_stock: 30, lead_time_reposicion: 5, sistema_reposicion: 80 } }
    ];

    expect(hasRequiredScrapingBlocks(results)).toBe(true);
    expect(buildDiagnosticInputFromScraping(results).ads.acos).toBe(10);
  });

  it("filters score history ranges and computes deltas", () => {
    const history = [
      { date: "2026-01-01", scoreGlobal: 70, salud: 70, publicaciones: 70, ads: 70, logistica: 70, stock: 70 },
      { date: "2026-03-01", scoreGlobal: 76, salud: 76, publicaciones: 76, ads: 76, logistica: 76, stock: 76 },
      { date: "2026-04-01", scoreGlobal: 72, salud: 72, publicaciones: 72, ads: 72, logistica: 72, stock: 72 }
    ];

    expect(normalizeHistoryPeriod("12")).toBe(12);
    expect(normalizeHistoryPeriod("x")).toBe(6);
    expect(filterHistoryByPeriod(history, 3, new Date("2026-04-22")).map((item) => item.date)).toEqual(["2026-03-01", "2026-04-01"]);
    expect(getCurrentAndPreviousHistory(history).previous?.scoreGlobal).toBe(76);
    expect(addScoreDeltas(history).map((item) => item.delta)).toEqual([null, 6, -4]);
  });

  it("calculates pricing scenarios for operator proposals", () => {
    const input = {
      plan: "growth",
      currentRevenue: 8_000_000,
      projectedRevenue: 11_500_000,
      grossMarginPct: 32,
      deliveryCost: 280_000,
      setupFee: 100_000,
      months: 6
    } as const;
    const result = calculatePricing(input);

    expect(normalizePricingPlan("scale")).toBe("scale");
    expect(toNumber("1.500.000")).toBe(1_500_000);
    expect(result.growth).toBe(3_500_000);
    expect(result.variableCommission).toBe(210_000);
    expect(result.monthlyFee).toBe(860_000);
    expect(result.operatorMarginPct).toBe(67);
    expect(result.recommended).toBe(true);
    expect(comparePricingPlans(input)).toHaveLength(3);
    expect(selectRecommendedPricingPlan(input).plan).toBe("starter");
    expect(getPricingSignals(input, result).map((signal) => signal.tone)).toContain("success");
  });

  it("separates Supabase service readiness from parser readiness", () => {
    const previous = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      service: process.env.SUPABASE_SERVICE_ROLE_KEY,
      parserUrl: process.env.PARSER_SERVICE_URL,
      parserSecret: process.env.PARSER_SERVICE_SECRET,
      anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      cron: process.env.CRON_SECRET,
      appUrl: process.env.APP_URL,
      encryption: process.env.APP_ENCRYPTION_KEY
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.CRON_SECRET = "cron";
    process.env.APP_URL = "https://meligrowth.example";
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    delete process.env.PARSER_SERVICE_URL;
    delete process.env.PARSER_SERVICE_SECRET;

    expect(isSupabaseServiceConfigured()).toBe(true);
    expect(isParserPipelineConfigured()).toBe(false);
    expect(getRuntimeReadiness().coreReady).toBe(true);

    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", previous.url);
    restoreEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", previous.anon);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previous.service);
    restoreEnv("PARSER_SERVICE_URL", previous.parserUrl);
    restoreEnv("PARSER_SERVICE_SECRET", previous.parserSecret);
    restoreEnv("CRON_SECRET", previous.cron);
    restoreEnv("APP_URL", previous.appUrl);
    restoreEnv("APP_ENCRYPTION_KEY", previous.encryption);
  });

  it("parses pricing templates uploaded as csv", async () => {
    const file = new File(
      ["plan,current_revenue,projected_revenue,gross_margin_pct,delivery_cost,setup_fee,months\nscale,18000000,26000000,34,420000,250000,6\n"],
      "pricing.csv",
      { type: "text/csv" }
    );

    const parsed = await parsePricingTemplate(file);

    expect(parsed.plan).toBe("scale");
    expect(parsed.currentRevenue).toBe(18_000_000);
    expect(parsed.projectedRevenue).toBe(26_000_000);
    expect(parsed.deliveryCost).toBe(420_000);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
