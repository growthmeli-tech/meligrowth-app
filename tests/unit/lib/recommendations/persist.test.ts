import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistRecommendationsAsAlerts } from "@/lib/recommendations/persist";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import { createMockAlert } from "@/tests/helpers/factories";
import {
  countUnresolvedAlertsForAccountSinceUtcStartOfDay,
  createAlertsBulk,
  listUnresolvedAlertsForAccountSinceUtcStartOfDay
} from "@/lib/data-v2/alerts";

vi.mock("@/lib/data-v2/alerts", () => ({
  createAlertsBulk: vi.fn(),
  countUnresolvedAlertsForAccountSinceUtcStartOfDay: vi.fn(),
  listUnresolvedAlertsForAccountSinceUtcStartOfDay: vi.fn()
}));

function createRecommendationsFixture(): DiagnosticRecommendations {
  return {
    client_id: "client-1",
    diagnostic_id: "health-1",
    score_global: 63,
    estado_global: "en_riesgo",
    estrategia_general: "Accion correctiva urgente",
    recomendacion_ads: "Pausar campañas con ACOS fuera de rango",
    recomendaciones: [
      {
        id: "rec-urgente",
        categoria: "salud",
        prioridad: "urgente",
        titulo: "Urgente salud",
        descripcion: "Descripcion urgente",
        accion_concreta: "Accion urgente",
        metrica_afectada: "reclamos",
        impacto_estimado: "alto",
        benchmark_objetivo: "objetivo urgente",
        audiencia: "internal",
        bloque: "01 Salud"
      },
      {
        id: "rec-alta",
        categoria: "ads",
        prioridad: "alta",
        titulo: "Alta ads",
        descripcion: "Descripcion alta",
        accion_concreta: "Accion alta",
        metrica_afectada: "roas",
        impacto_estimado: "alto",
        benchmark_objetivo: "objetivo alta",
        audiencia: "manager",
        bloque: "03 Ads"
      },
      {
        id: "rec-media",
        categoria: "stock",
        prioridad: "media",
        titulo: "Media stock",
        descripcion: "Descripcion media",
        accion_concreta: "Accion media",
        metrica_afectada: "skus_sin_stock_pct",
        impacto_estimado: "medio",
        benchmark_objetivo: "objetivo media",
        audiencia: "operator",
        bloque: "05 Stock"
      },
      {
        id: "rec-baja",
        categoria: "publicaciones",
        prioridad: "baja",
        titulo: "Baja publicaciones",
        descripcion: "Descripcion baja",
        accion_concreta: "Accion baja",
        metrica_afectada: "ctr",
        impacto_estimado: "bajo",
        benchmark_objetivo: "objetivo baja",
        audiencia: "operator",
        bloque: "02 Publicaciones"
      }
    ],
    bloques_criticos: ["01 Salud", "03 Ads"],
    bloques_saludables: [],
    generated_at: "2026-04-24T10:15:00.000Z"
  };
}

describe("persistRecommendationsAsAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countUnresolvedAlertsForAccountSinceUtcStartOfDay).mockResolvedValue({ success: true, data: 0 });
    vi.mocked(listUnresolvedAlertsForAccountSinceUtcStartOfDay).mockResolvedValue({ success: true, data: [] });
  });

  it("si ya hay alertas sin resolver hoy (UTC) para la cuenta, no inserta y devuelve las existentes", async () => {
    const existing = [
      createMockAlert("internal", { id: "existing-1", health_id: "health-1" }),
      createMockAlert("manager", { id: "existing-2", prioridad: "alta", audiencia: "manager", health_id: "health-1" })
    ];
    vi.mocked(countUnresolvedAlertsForAccountSinceUtcStartOfDay).mockResolvedValue({ success: true, data: 2 });
    vi.mocked(listUnresolvedAlertsForAccountSinceUtcStartOfDay).mockResolvedValue({ success: true, data: existing });

    const result = await persistRecommendationsAsAlerts({
      ml_account_id: "ml-account-1",
      health_id: "health-1",
      recommendations: createRecommendationsFixture()
    });

    expect(countUnresolvedAlertsForAccountSinceUtcStartOfDay).toHaveBeenCalledWith("ml-account-1");
    expect(listUnresolvedAlertsForAccountSinceUtcStartOfDay).toHaveBeenCalledWith("ml-account-1");
    expect(createAlertsBulk).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alerts).toEqual(existing);
      expect(result.data.persisted_count).toBe(2);
    }
  });

  it("solo persiste alertas urgente y alta, excluye media y baja", async () => {
    vi.mocked(createAlertsBulk).mockResolvedValue({
      success: true,
      data: [createMockAlert("internal"), createMockAlert("manager", { id: "alert-2", prioridad: "alta" })]
    });

    await persistRecommendationsAsAlerts({
      ml_account_id: "ml-account-1",
      health_id: "health-1",
      recommendations: createRecommendationsFixture()
    });

    const insertPayload = vi.mocked(createAlertsBulk).mock.calls[0]?.[0] ?? [];
    expect(insertPayload).toHaveLength(2);
    expect(insertPayload.every((item) => item.prioridad === "urgente" || item.prioridad === "alta")).toBe(true);
  });

  it("vincula health_id correctamente al payload persistido", async () => {
    vi.mocked(createAlertsBulk).mockResolvedValue({
      success: true,
      data: [createMockAlert("internal")]
    });

    await persistRecommendationsAsAlerts({
      ml_account_id: "ml-account-1",
      health_id: "health-link-123",
      recommendations: createRecommendationsFixture()
    });

    const insertPayload = vi.mocked(createAlertsBulk).mock.calls[0]?.[0] ?? [];
    expect(insertPayload[0]?.health_id).toBe("health-link-123");
    expect(insertPayload[1]?.health_id).toBe("health-link-123");
  });

  it("retorna el count de alertas persistidas", async () => {
    vi.mocked(createAlertsBulk).mockResolvedValue({
      success: true,
      data: [
        createMockAlert("internal"),
        createMockAlert("manager", { id: "alert-2", prioridad: "alta", audiencia: "manager" })
      ]
    });

    const result = await persistRecommendationsAsAlerts({
      ml_account_id: "ml-account-1",
      health_id: "health-1",
      recommendations: createRecommendationsFixture()
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.persisted_count).toBe(2);
    }
  });

  it("falla de forma controlada cuando Supabase devuelve error", async () => {
    vi.mocked(createAlertsBulk).mockResolvedValue({
      success: false,
      error: "No se pudieron crear alertas",
      code: "PGRST116"
    });

    const result = await persistRecommendationsAsAlerts({
      ml_account_id: "ml-account-1",
      health_id: "health-1",
      recommendations: createRecommendationsFixture()
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/alertas/i);
      expect(result.code).toBe("PGRST116");
    }
  });
});
