import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ml/auth", () => ({
  getValidAccessToken: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/reputation", () => ({
  getSellerReputationDetails: vi.fn(),
  mapReputationToDiagnostic: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/listings", () => ({
  getListingsStats: vi.fn(),
  getListingsOptimizationRate: vi.fn(),
  getMarketplaceListingsCap: vi.fn(),
  mapListingsToDiagnostic: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/ads", () => ({
  getAdvertiserId: vi.fn(),
  getAdsMetrics: vi.fn(),
  mapAdsToDiagnostic: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/logistics", () => ({
  getLogisticsMetrics: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/stock", () => ({
  getStockMetrics: vi.fn()
}));
vi.mock("@/lib/data-v2/metric-snapshots", () => ({
  createMetricSnapshot: vi.fn(),
  getLatestMetricSnapshotByAccount: vi.fn()
}));
vi.mock("@/lib/data-v2/ingestion-runs", () => ({
  createIngestionRunPipeline: vi.fn(),
  finishIngestionRunPipeline: vi.fn()
}));
vi.mock("@/lib/recommendations/pipeline-v2", () => ({
  runRecommendationsPipelineV2: vi.fn()
}));
vi.mock("@/lib/ml/sync-catalog", () => ({
  syncMlCatalog: vi.fn().mockResolvedValue(undefined)
}));

import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { getValidAccessToken } from "@/lib/ml/auth";
import { getSellerReputationDetails, mapReputationToDiagnostic } from "@/lib/ml/endpoints/reputation";
import { getListingsOptimizationRate, getListingsStats, getMarketplaceListingsCap, mapListingsToDiagnostic } from "@/lib/ml/endpoints/listings";
import { getAdvertiserId, getAdsMetrics, mapAdsToDiagnostic } from "@/lib/ml/endpoints/ads";
import { getLogisticsMetrics } from "@/lib/ml/endpoints/logistics";
import { getStockMetrics } from "@/lib/ml/endpoints/stock";
import { createMetricSnapshot, getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { createIngestionRunPipeline, finishIngestionRunPipeline } from "@/lib/data-v2/ingestion-runs";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";

describe("ML pipeline stock snapshot persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getValidAccessToken).mockResolvedValue("token");
    vi.mocked(getSellerReputationDetails).mockResolvedValue({} as never);
    vi.mocked(mapReputationToDiagnostic).mockReturnValue({
      reclamos: 0.6,
      mediaciones: 0.2,
      cancelaciones_vendedor: 0.3,
      envios_a_tiempo: 90,
      nivel_vendedor: null,
      ventas_completadas_60d: null,
      periodo_reputacion: null,
      reputacion_protegida: false,
      reputacion_real_level: null,
      reputacion_level_id: null,
      vendedor_protegido_reclamos: false,
      reclamos_nota: null
    });
    vi.mocked(getListingsStats).mockResolvedValue({ total: 100, active: 70, paused: 30 });
    vi.mocked(getListingsOptimizationRate).mockResolvedValue(65);
    vi.mocked(getMarketplaceListingsCap).mockResolvedValue({ quota: null, total_items: null });
    vi.mocked(mapListingsToDiagnostic).mockReturnValue({
      pubs_activas_pct: 70,
      pubs_optimizadas_pct: 65,
      ctr: null
    });
    vi.mocked(getAdvertiserId).mockResolvedValue(12345);
    vi.mocked(getAdsMetrics).mockResolvedValue({ spend: 1000, ventas_ads: 5000, ventas_totales: 20000 });
    vi.mocked(mapAdsToDiagnostic).mockReturnValue({
      gasto_ads: 1000,
      ventas_ads: 5000,
      ventas_totales: 20000,
      acos: 20,
      roas: 5,
      tacos: 5
    });
    vi.mocked(getLogisticsMetrics).mockResolvedValue({
      incidencias_pct: 1,
      uso_full_flex_pct: 50,
      cancelaciones_stock_pct: 0.8
    });
    vi.mocked(getStockMetrics).mockResolvedValue({
      skus_sin_stock_pct: 4,
      dias_stock: null,
      lead_time_reposicion: null
    });
    vi.mocked(createIngestionRunPipeline).mockResolvedValue({ success: true, data: { id: "run-1" } as never });
    vi.mocked(finishIngestionRunPipeline).mockResolvedValue({ success: true, data: {} as never });
    vi.mocked(runRecommendationsPipelineV2).mockResolvedValue({
      success: true,
      data: { persisted_alerts_count: 0 } as never
    });
    vi.mocked(createMetricSnapshot).mockResolvedValue({ success: true, data: { id: "snap-1" } as never });
  });

  it("does not wipe Excel dias_stock when ML stock fetch returns null coverage", async () => {
    vi.mocked(getLatestMetricSnapshotByAccount).mockResolvedValue({
      success: true,
      data: {
        dias_stock: 32,
        skus_sin_stock_pct: 15,
        lead_time_reposicion: 7
      } as never
    });

    const result = await fetchMLDiagnosticData("client-1", "123456789", { mlAccountId: "acc-1" });
    expect(result.success).toBe(true);
    expect(createMetricSnapshot).toHaveBeenCalledOnce();
    const payload = vi.mocked(createMetricSnapshot).mock.calls[0][0];
    expect(payload.dias_stock).toBe(32);
    expect(payload.lead_time_reposicion).toBe(7);
    expect(payload.skus_sin_stock_pct).toBe(4);
    expect(payload.ml_account_id).toBe("acc-1");
  });

  it("skips persist when the existing snapshot cannot be loaded", async () => {
    vi.mocked(getLatestMetricSnapshotByAccount).mockResolvedValue({
      success: false,
      error: "snapshot load failed"
    });

    const result = await fetchMLDiagnosticData("client-1", "123456789", { mlAccountId: "acc-1" });
    expect(result.success).toBe(true);
    expect(createMetricSnapshot).not.toHaveBeenCalled();
  });
});
