import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAccountHealth, createMockMetricSnapshot } from "@/tests/helpers/factories";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  })
}));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));
vi.mock("@/lib/data-v2/metric-snapshots", () => ({
  createMetricSnapshot: vi.fn()
}));
vi.mock("@/lib/recommendations/pipeline-v2", () => ({
  runRecommendationsPipelineV2: vi.fn()
}));

import { createDiagnostic } from "@/app/(internal)/internal/clients/[id]/diagnostic/new/actions";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function supabaseWithCompany() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-operator-1" } } }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { name: "Suplementos Madero", plan: "360" },
            error: null
          }))
        }))
      }))
    }))
  } as never;
}

function createFormData() {
  const formData = new FormData();
  const fields: Record<string, string> = {
    date: "2026-04-24",
    source: "manual",
    reclamos: "0.6",
    mediaciones: "0.2",
    cancelaciones_vendedor: "0.3",
    envios_a_tiempo: "90",
    pubs_activas_pct: "64.4",
    pubs_optimizadas_pct: "70",
    ctr: "2.1",
    margen_pre_ads: "30",
    gasto_ads: "20000",
    ventas_ads: "10000",
    ventas_totales: "30000",
    acos: "200",
    roas: "0.5",
    tacos: "66.7",
    incidencias_pct: "1.2",
    uso_full_flex_pct: "58",
    cancelaciones_stock_pct: "0.8",
    skus_sin_stock_pct: "3.6",
    dias_stock: "38",
    lead_time_reposicion: "9",
    sistema_reposicion: "3"
  };

  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const mockRecommendations: DiagnosticRecommendations = {
  client_id: "company-1",
  diagnostic_id: "health-1",
  score_global: 63,
  estado_global: "en_riesgo",
  estrategia_general: "Accion correctiva urgente",
  recomendacion_ads: "CRITICO",
  recomendaciones: [],
  bloques_criticos: ["03 Ads"],
  bloques_saludables: [],
  generated_at: new Date().toISOString()
};

describe("Server action createDiagnostic (v2 snapshot + pipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(supabaseWithCompany());
    vi.mocked(createMetricSnapshot).mockResolvedValue({
      success: true,
      data: createMockMetricSnapshot({ id: "snapshot-1", ml_account_id: "ml-account-1" })
    });
    vi.mocked(runRecommendationsPipelineV2).mockResolvedValue({
      success: true,
      data: {
        account_health: createMockAccountHealth({
          id: "health-1",
          ml_account_id: "ml-account-1",
          score_global: 63,
          estado_global: "en_riesgo"
        }),
        recommendations: mockRecommendations,
        persisted_alerts_count: 0
      }
    });
  });

  it("crea snapshot, corre pipeline v2 y devuelve diagnostic + recommendations", async () => {
    const result = await createDiagnostic("company-1", "ml-account-1", createFormData());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diagnostic.id).toBe("health-1");
      expect(result.data.diagnostic.score_global).toBeGreaterThanOrEqual(0);
      expect(result.data.diagnostic.score_global).toBeLessThanOrEqual(100);
      expect(result.data.recommendations.diagnostic_id).toBe("health-1");
    }
    expect(createMetricSnapshot).toHaveBeenCalledOnce();
    expect(runRecommendationsPipelineV2).toHaveBeenCalledWith({
      ml_account_id: "ml-account-1",
      metric_snapshot_id: "snapshot-1"
    });
  });

  it("pasa null a createMetricSnapshot cuando un campo opcional va vacío (no 0 por defecto)", async () => {
    const formData = createFormData();
    formData.set("ctr", "");
    formData.set("dias_stock", "");
    const result = await createDiagnostic("company-1", "ml-account-1", formData);
    expect(result.success).toBe(true);
    const insertCall = vi.mocked(createMetricSnapshot).mock.calls[0][0] as { ctr: number | null; dias_stock: number | null };
    expect(insertCall.ctr).toBeNull();
    expect(insertCall.dias_stock).toBeNull();
  });

  it("retorna error cuando createMetricSnapshot falla (p. ej. permisos)", async () => {
    vi.mocked(createMetricSnapshot).mockResolvedValueOnce({
      success: false,
      error: "new row violates row-level security policy",
      code: "42501"
    });

    const result = await createDiagnostic("company-1", "ml-account-1", createFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/violates row-level security/i);
    }
  });
});
