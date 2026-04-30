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

import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { getValidAccessToken } from "@/lib/ml/auth";
import { getSellerReputationDetails, mapReputationToDiagnostic } from "@/lib/ml/endpoints/reputation";
import { getListingsOptimizationRate, getListingsStats, getMarketplaceListingsCap, mapListingsToDiagnostic } from "@/lib/ml/endpoints/listings";
import { getAdvertiserId, getAdsMetrics, mapAdsToDiagnostic } from "@/lib/ml/endpoints/ads";
import { getLogisticsMetrics } from "@/lib/ml/endpoints/logistics";
import { getStockMetrics } from "@/lib/ml/endpoints/stock";

describe("ML pipeline", () => {
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
  });

  it("retorna prefill exitoso cuando todos los bloques responden", async () => {
    const result = await fetchMLDiagnosticData("client-1", "123456789");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seller_id).toBe("123456789");
      expect(result.data.data_sources.salud).toBe("api");
      expect(result.data.data_sources.stock).toBe("api");
    }
  });

  it("retorna error claro cuando no hay sesion valida", async () => {
    vi.mocked(getValidAccessToken).mockRejectedValueOnce(new Error("No session"));
    const result = await fetchMLDiagnosticData("client-1", "123456789");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/sesion valida|sesión válida/i);
    }
  });

  it("continua cuando falla un bloque y deja data source unavailable", async () => {
    vi.mocked(getStockMetrics).mockRejectedValueOnce(new Error("Stock down"));
    const result = await fetchMLDiagnosticData("client-1", "123456789");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data_sources.stock).toBe("unavailable");
      expect(result.data.data_sources.salud).toBe("api");
    }
  });
});
