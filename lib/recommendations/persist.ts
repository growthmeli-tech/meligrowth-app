import { createAlertsBulk } from "@/lib/data-v2/alerts";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type AlertInsert = Database["public"]["Tables"]["alerts"]["Insert"];

type PersistRecommendationsInput = {
  ml_account_id: string;
  health_id: string;
  recommendations: DiagnosticRecommendations;
};

type PersistRecommendationsOutput = {
  persisted_count: number;
  alerts: AlertRow[];
};

export async function persistRecommendationsAsAlerts(
  input: PersistRecommendationsInput
): Promise<ActionResult<PersistRecommendationsOutput>> {
  const candidates = input.recommendations.recomendaciones.filter(
    (recommendation) => recommendation.prioridad === "urgente" || recommendation.prioridad === "alta"
  );

  if (candidates.length === 0) {
    return {
      success: true,
      data: {
        persisted_count: 0,
        alerts: []
      }
    };
  }

  const payload: AlertInsert[] = candidates.map((recommendation) => ({
    ml_account_id: input.ml_account_id,
    health_id: input.health_id,
    categoria: recommendation.categoria,
    prioridad: recommendation.prioridad,
    titulo: recommendation.titulo,
    descripcion: recommendation.descripcion,
    accion_concreta: recommendation.accion_concreta,
    benchmark_objetivo: recommendation.benchmark_objetivo,
    audiencia: recommendation.audiencia
  }));

  const result = await createAlertsBulk(payload);
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: {
      persisted_count: result.data.length,
      alerts: result.data
    }
  };
}
