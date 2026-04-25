import type { ScoreStatus } from "@/lib/types/enums";

export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 95) return "platinum";
  if (score >= 85) return "muy_bueno";
  if (score >= 70) return "solido";
  if (score >= 55) return "en_desarrollo";
  if (score >= 40) return "en_riesgo";
  return "critico";
}

export function getScoreLabel(score: number): string {
  const labels: Record<ScoreStatus, string> = {
    platinum: "Platinum",
    muy_bueno: "Muy bueno",
    solido: "Solido",
    en_desarrollo: "En desarrollo",
    en_riesgo: "En riesgo",
    critico: "Critico"
  };
  return labels[getScoreStatus(score)];
}

export function getScoreTailwind(score: number): string {
  const classes: Record<ScoreStatus, string> = {
    platinum: "text-green-700 bg-green-50 border-green-200",
    muy_bueno: "text-green-600 bg-green-50 border-green-100",
    solido: "text-blue-600 bg-blue-50 border-blue-200",
    en_desarrollo: "text-yellow-700 bg-yellow-50 border-yellow-200",
    en_riesgo: "text-orange-600 bg-orange-50 border-orange-200",
    critico: "text-red-600 bg-red-50 border-red-200"
  };
  return classes[getScoreStatus(score)];
}
