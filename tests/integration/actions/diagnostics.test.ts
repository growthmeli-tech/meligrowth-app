import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDiagnostic } from "@/tests/helpers/factories";

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
vi.mock("@/lib/diagnostics/persist-diagnostic", () => ({
  persistDiagnostic: vi.fn()
}));
vi.mock("@/lib/recommendations/engine", () => ({
  generateRecommendations: vi.fn()
}));

import { createDiagnostic } from "@/app/(internal)/internal/clients/[id]/diagnostic/new/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistDiagnostic } from "@/lib/diagnostics/persist-diagnostic";
import { generateRecommendations } from "@/lib/recommendations/engine";

function createFormData() {
  const formData = new FormData();
  const fields: Record<string, string> = {
    date: "2026-04-24",
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

describe("Server action createDiagnostic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-operator-1" } } }))
      }
    } as never);
    vi.mocked(persistDiagnostic).mockResolvedValue({
      ok: true,
      diagnostic: createMockDiagnostic()
    } as never);
    vi.mocked(generateRecommendations).mockReturnValue({
      client_id: "client-1",
      diagnostic_id: "diag-1",
      score_global: 63,
      estado_global: "en_riesgo",
      estrategia_general: "Accion correctiva urgente",
      recomendacion_ads: "CRITICO",
      recomendaciones: [],
      bloques_criticos: ["03 Ads"],
      bloques_saludables: [],
      generated_at: new Date().toISOString()
    });
  });

  it("guarda diagnostico y devuelve diagnostic + recommendations", async () => {
    const result = await createDiagnostic("client-1", createFormData());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diagnostic.client_id).toBe("client-1");
      expect(result.data.diagnostic.score_global).toBeGreaterThanOrEqual(0);
      expect(result.data.diagnostic.score_global).toBeLessThanOrEqual(100);
      expect(result.data.recommendations.diagnostic_id).toBe("diag-1");
    }
  });

  it("retorna error cuando persistDiagnostic falla por permisos", async () => {
    vi.mocked(persistDiagnostic).mockResolvedValueOnce({
      ok: false,
      error: "Error de permisos"
    } as never);

    const result = await createDiagnostic("otro-operator-client", createFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/permisos/i);
    }
  });
});
