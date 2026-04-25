export type RecommendationPriority = "urgente" | "alta" | "media" | "baja";
export type RecommendationCategory = "salud" | "publicaciones" | "ads" | "logistica" | "stock";
export type RecommendationAudience = "operator" | "client" | "both";
export type ScoreStatus = "platinum" | "muy_bueno" | "solido" | "en_desarrollo" | "en_riesgo" | "critico";

export type Recommendation = {
  id: string;
  categoria: RecommendationCategory;
  prioridad: RecommendationPriority;
  titulo: string;
  descripcion: string;
  accion_concreta: string;
  metrica_afectada: string;
  impacto_estimado: string;
  benchmark_objetivo: string;
  audiencia: RecommendationAudience;
  bloque: string;
};

export type DiagnosticRecommendations = {
  client_id: string;
  diagnostic_id: string;
  score_global: number;
  estado_global: string;
  estrategia_general: string;
  recomendacion_ads: string;
  recomendaciones: Recommendation[];
  bloques_criticos: string[];
  bloques_saludables: string[];
  generated_at: string;
};

export type MetricaBenchmark = {
  metrica: string;
  valor: number;
  estado: ScoreStatus;
  benchmark_texto: string;
  accion: string;
  objetivo: string;
  brecha: number | null;
};

export type AdsAnalysis = {
  acos: number;
  roas: number;
  tacos: number;
  roas_minimo: number;
  diferencial_roas: number;
  margen_efectivo: number;
  contribucion_neta: number;
  estado_salud: "critico" | "aceptable" | "saludable" | "escalable" | "sin_datos";
  recomendacion: string;
};

export type MetricInput = {
  campo: string;
  valor: number;
  categoria: RecommendationCategory;
  peso: number;
};
