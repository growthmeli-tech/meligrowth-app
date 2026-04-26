import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDiagnostic } from "@/tests/helpers/factories";
import { createMockMLPrefill } from "@/tests/helpers/ml-api-mock";
import { createSupabaseMock } from "@/tests/helpers/supabase-mock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  })
}));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: vi.fn(() => true)
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));
vi.mock("@/lib/diagnostics/persist-diagnostic", () => ({
  persistDiagnostic: vi.fn()
}));

import { createDiagnostic } from "@/app/(operator)/operator/clients/[id]/diagnostic/new/actions";
import { getDiagnosticHistory, getDiagnosticWithDelta, getEstadoSimpleParaCliente } from "@/lib/data/diagnostics";
import { getClientRecommendations } from "@/lib/data/recommendations";
import { generateRecommendations } from "@/lib/recommendations/engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistDiagnostic } from "@/lib/diagnostics/persist-diagnostic";

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
    sistema_reposicion: "3",
    source: "scraping"
  };

  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("Cadena completa de integracion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Eslabon 1: API ML -> Formulario", () => {
    it("el prefill contiene campos esperados y data_sources por bloque", () => {
      const prefill = createMockMLPrefill();
      expect(prefill).toHaveProperty("reclamos");
      expect(prefill).toHaveProperty("pubs_activas_pct");
      expect(prefill).toHaveProperty("gasto_ads");
      expect(prefill).toHaveProperty("incidencias_pct");
      expect(prefill).toHaveProperty("skus_sin_stock_pct");
      expect(prefill.data_sources).toMatchObject({
        salud: expect.any(String),
        publicaciones: expect.any(String),
        ads: expect.any(String),
        logistica: expect.any(String),
        stock: expect.any(String)
      });
    });
  });

  describe("Eslabones 2 y 4: Formulario -> Supabase -> Motor", () => {
    it("createDiagnostic retorna diagnostic y recomendaciones", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        createSupabaseMock({ authUser: { id: "user-operator-1" } }) as never
      );
      vi.mocked(persistDiagnostic).mockResolvedValue({
        ok: true,
        diagnostic: createMockDiagnostic()
      } as never);

      const result = await createDiagnostic("client-1", createFormData());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagnostic.client_id).toBe("client-1");
        expect(Array.isArray(result.data.recommendations.recomendaciones)).toBe(true);
      }
    });
  });

  describe("Eslabon 3: Supabase -> score_history trigger", () => {
    it("getDiagnosticHistory normaliza score_pubs como publicaciones", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        createSupabaseMock({
          byTable: {
            score_history: {
              data: [
                {
                  id: "h-1",
                  client_id: "client-1",
                  date: "2026-04-01",
                  score_global: 58,
                  score_salud: 60,
                  score_pubs: 55,
                  score_ads: 40,
                  score_logistica: 70,
                  score_stock: 65
                }
              ]
            }
          }
        }) as never
      );

      const result = await getDiagnosticHistory("client-1", 6);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].publicaciones).toBe(55);
      }
    });
  });

  describe("Eslabon 5: Motor -> UI Operator", () => {
    it("getClientRecommendations entrega contrato para RecommendationsPanel", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        createSupabaseMock({
          byTable: {
            diagnostics: {
              data: createMockDiagnostic()
            }
          }
        }) as never
      );
      const result = await getClientRecommendations("client-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("estrategia_general");
        expect(result.data).toHaveProperty("recomendaciones");
      }
    });
  });

  describe("Eslabones 6 y 7: Score/dashboard y alertabilidad", () => {
    it("getDiagnosticWithDelta calcula delta y estado simple traduce lenguaje", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        createSupabaseMock({
          byTable: {
            diagnostics: {
              data: [
                createMockDiagnostic({ id: "d-2", score_global: 70 }),
                createMockDiagnostic({ id: "d-1", score_global: 60, date: "2026-03-20" })
              ]
            }
          }
        }) as never
      );
      const result = await getDiagnosticWithDelta("client-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.delta).toBe(10);
      }
      expect(getEstadoSimpleParaCliente("riesgo")).toContain("atención");
    });

    it("el motor produce recomendaciones con prioridad para UI/alertas", () => {
      const recs = generateRecommendations(createMockDiagnostic());
      expect(recs.recomendaciones.length).toBeGreaterThan(0);
      expect(recs.recomendaciones.some((item) => item.prioridad === "urgente" || item.prioridad === "alta")).toBe(true);
    });
  });
});
