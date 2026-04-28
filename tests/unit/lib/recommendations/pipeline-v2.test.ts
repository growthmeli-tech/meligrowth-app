import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import type { Database } from "@/lib/supabase/database.types";
import type { Recommendation } from "@/lib/recommendations/types";
import { createMockAccountHealth, createMockMetricSnapshot } from "@/tests/helpers/factories";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistRecommendationsAsAlerts } from "@/lib/recommendations/persist";

type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type AccountHealthRow = Database["public"]["Tables"]["account_health"]["Row"];

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/recommendations/persist", () => ({
  persistRecommendationsAsAlerts: vi.fn()
}));

vi.mock("@/lib/recommendations/ai-enricher", () => ({
  enrichRecommendationsWithClaude: vi.fn(async (recs: Recommendation[]) => recs.map((r) => ({ ...r, steps: [] as string[] })))
}));

function createPipelineSupabaseMock(snapshot: MetricSnapshotRow, healthOverride: Partial<AccountHealthRow> = {}) {
  let insertedHealth: Partial<AccountHealthRow> | null = null;

  const metricSnapshotQuery = {
    select: vi.fn(() => metricSnapshotQuery),
    eq: vi.fn(() => metricSnapshotQuery),
    maybeSingle: vi.fn(async () => ({ data: snapshot, error: null }))
  };

  const healthInsertQuery = {
    select: vi.fn(() => healthInsertQuery),
    single: vi.fn(async () => ({
      data: {
        ...createMockAccountHealth(),
        ...insertedHealth,
        ...healthOverride
      },
      error: null
    }))
  };

  const accountHealthQuery = {
    insert: vi.fn((payload: Partial<AccountHealthRow>) => {
      insertedHealth = payload;
      return healthInsertQuery;
    })
  };

  const alertsCountQuery = {
    select: vi.fn(() => alertsCountQuery),
    eq: vi.fn(() => alertsCountQuery),
    gte: vi.fn(() => alertsCountQuery),
    not: vi.fn(async () => ({ count: 0, error: null }))
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === "metric_snapshots") return metricSnapshotQuery;
      if (table === "account_health") return accountHealthQuery;
      if (table === "alerts") return alertsCountQuery;
      throw new Error(`Tabla no mockeada: ${table}`);
    })
  };

  return {
    client,
    getInsertedHealth: () => insertedHealth
  };
}

describe("runRecommendationsPipelineV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(persistRecommendationsAsAlerts).mockResolvedValue({
      success: true,
      data: {
        persisted_count: 2,
        alerts: []
      }
    });
  });

  it("retorna account_health, recommendations y persisted_alerts_count", async () => {
    const snapshot = createMockMetricSnapshot();
    const supabaseMock = createPipelineSupabaseMock(snapshot);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabaseMock.client as never);

    const result = await runRecommendationsPipelineV2({
      ml_account_id: snapshot.ml_account_id,
      metric_snapshot_id: snapshot.id
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.account_health).toBeDefined();
      expect(Array.isArray(result.data.recommendations.recomendaciones)).toBe(true);
      expect(result.data.persisted_alerts_count).toBe(2);
    }
  });

  it("garantiza que score_global se mantenga entre 0 y 100", async () => {
    const snapshot = createMockMetricSnapshot({
      reclamos: 999,
      mediaciones: 999,
      cancelaciones_vendedor: 999,
      envios_a_tiempo: -50,
      pubs_activas_pct: -30,
      pubs_optimizadas_pct: -10,
      ctr: -1,
      margen_pre_ads: 0,
      gasto_ads: 0,
      ventas_ads: 0,
      ventas_totales: 0
    });
    const supabaseMock = createPipelineSupabaseMock(snapshot);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabaseMock.client as never);

    const result = await runRecommendationsPipelineV2({
      ml_account_id: snapshot.ml_account_id,
      metric_snapshot_id: snapshot.id
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.account_health.score_global).toBeGreaterThanOrEqual(0);
      expect(result.data.account_health.score_global).toBeLessThanOrEqual(100);
    }
  });

  it("si Ads no tiene datos, excluye Ads y redistribuye pesos del score global", async () => {
    const snapshot = createMockMetricSnapshot({
      margen_pre_ads: null,
      gasto_ads: null,
      ventas_ads: null,
      ventas_totales: null,
      acos: null,
      roas: null,
      tacos: null
    });
    const supabaseMock = createPipelineSupabaseMock(snapshot);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabaseMock.client as never);

    const result = await runRecommendationsPipelineV2({
      ml_account_id: snapshot.ml_account_id,
      metric_snapshot_id: snapshot.id
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const health = result.data.account_health;
      const expectedWithRedistribution =
        (Number(health.score_salud ?? 0) * 0.4375) +
        (Number(health.score_publicaciones ?? 0) * 0.25) +
        (Number(health.score_logistica ?? 0) * 0.1875) +
        (Number(health.score_stock ?? 0) * 0.125);

      expect(health.score_global).toBeCloseTo(expectedWithRedistribution, 0);
    }
  });

  it("genera alertas con audiencia internal, manager, operator y all", async () => {
    const snapshot = createMockMetricSnapshot({
      reclamos: 5,
      envios_a_tiempo: 80,
      roas: 1,
      gasto_ads: 20000,
      ventas_ads: 10000,
      ventas_totales: 30000,
      pubs_activas_pct: 40
    });
    const supabaseMock = createPipelineSupabaseMock(snapshot);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabaseMock.client as never);

    const result = await runRecommendationsPipelineV2({
      ml_account_id: snapshot.ml_account_id,
      metric_snapshot_id: snapshot.id
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const audiences = new Set(result.data.recommendations.recomendaciones.map((item) => item.audiencia));
      expect(audiences.has("internal")).toBe(true);
      expect(audiences.has("manager")).toBe(true);
      expect(audiences.has("operator")).toBe(true);
      expect(audiences.has("all")).toBe(true);
    }
  });
});
