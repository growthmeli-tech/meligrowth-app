import type { RecommendationCategory, RecommendationPriority, ScoreStatus } from "@/lib/recommendations/types";

const DEFAULT_PRIORITY_BY_STATUS: Record<ScoreStatus, RecommendationPriority> = {
  critico: "urgente",
  en_riesgo: "alta",
  en_desarrollo: "media",
  solido: "baja",
  muy_bueno: "baja",
  platinum: "baja"
};

export function getPrioridadRecomendacion(estado: ScoreStatus, categoria: RecommendationCategory): RecommendationPriority {
  if (categoria === "salud" && (estado === "critico" || estado === "en_riesgo")) return "urgente";
  if (categoria === "ads" && estado === "critico") return "urgente";
  return DEFAULT_PRIORITY_BY_STATUS[estado];
}

export function sortByPriority<T extends { prioridad: RecommendationPriority }>(items: T[]): T[] {
  const order: Record<RecommendationPriority, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
  return [...items].sort((a, b) => order[a.prioridad] - order[b.prioridad]);
}
