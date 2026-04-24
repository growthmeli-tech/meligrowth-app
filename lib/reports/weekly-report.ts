import type { Action } from "@/lib/types";

export type WeeklyDiagnostic = {
  scoreGlobal: number;
  date: string;
};

export function calcWeeklyDelta(current?: WeeklyDiagnostic | null, previous?: WeeklyDiagnostic | null) {
  if (!current || !previous) return null;
  return current.scoreGlobal - previous.scoreGlobal;
}

export function selectTopWeeklyActions(actions: Pick<Action, "prioridad" | "estado" | "titulo" | "descripcion">[], limit = 3) {
  const priorityRank = { urgente: 0, alta: 1, media: 2 };

  return actions
    .filter((action) => action.estado !== "completada")
    .sort((a, b) => priorityRank[a.prioridad] - priorityRank[b.prioridad])
    .slice(0, limit);
}

export function weeklyScorePhrase(score: number) {
  if (score >= 85) return "La cuenta mantiene una evolución sólida.";
  if (score >= 70) return "La cuenta está en desarrollo y con oportunidades claras de mejora.";
  if (score >= 55) return "La cuenta requiere seguimiento cercano esta semana.";
  return "La cuenta está en estado crítico y requiere foco inmediato.";
}
