import type { ScoreStatus } from "@/lib/recommendations/types";

const STRATEGY_BY_STATUS: Record<ScoreStatus, { accion: string; ads: string }> = {
  platinum: {
    accion: "Escalar con control",
    ads: "Aumentar inversion en top productos con margen validado."
  },
  muy_bueno: {
    accion: "Escalar con monitoreo",
    ads: "Escalar ads en campanas top sosteniendo ROAS."
  },
  solido: {
    accion: "Optimizar antes de escalar",
    ads: "No escalar ads hasta cerrar brechas operativas."
  },
  en_desarrollo: {
    accion: "Corregir brechas clave",
    ads: "Frenar ads y corregir publicaciones primero."
  },
  en_riesgo: {
    accion: "Accion correctiva urgente",
    ads: "Pausar escalado y mantener solo campanas rentables."
  },
  critico: {
    accion: "Plan de rescate",
    ads: "Pausar toda inversion en ads."
  }
};

export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 95) return "platinum";
  if (score >= 85) return "muy_bueno";
  if (score >= 70) return "solido";
  if (score >= 55) return "en_desarrollo";
  if (score >= 40) return "en_riesgo";
  return "critico";
}

export function getStrategyForScore(score: number) {
  return STRATEGY_BY_STATUS[getScoreStatus(score)];
}
