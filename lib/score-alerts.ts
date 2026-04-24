import { blockLabels } from "@/lib/theme";
import type { BloqueScores, BlockKey } from "@/lib/types";

export type ScoreSnapshot = {
  scoreGlobal: number;
  scores: BloqueScores;
};

export type ScoreAlert = {
  tipo: "score_bajo" | "alerta_critica";
  titulo: string;
  mensaje: string;
};

export function generateScoreAlerts({
  clientName,
  current,
  previous
}: {
  clientName: string;
  current: ScoreSnapshot;
  previous?: ScoreSnapshot | null;
}): ScoreAlert[] {
  const alerts: ScoreAlert[] = [];

  if (previous) {
    const delta = current.scoreGlobal - previous.scoreGlobal;
    if (delta <= -10) {
      alerts.push({
        tipo: "score_bajo",
        titulo: "Caída fuerte de score",
        mensaje: `${clientName} bajó ${Math.abs(delta)} puntos: de ${previous.scoreGlobal} a ${current.scoreGlobal}.`
      });
    }
  }

  const criticalBlocks = (Object.entries(current.scores) as Array<[BlockKey, number]>)
    .filter(([, score]) => score < 55)
    .sort((a, b) => a[1] - b[1]);

  if (criticalBlocks.length > 0) {
    alerts.push({
      tipo: "alerta_critica",
      titulo: "Bloque crítico detectado",
      mensaje: `${clientName} tiene ${criticalBlocks
        .map(([block, score]) => `${blockLabels[block]} (${score})`)
        .join(", ")} en estado crítico.`
    });
  }

  if (current.scoreGlobal < 55) {
    alerts.push({
      tipo: "alerta_critica",
      titulo: "Cuenta crítica",
      mensaje: `${clientName} quedó con score global crítico: ${current.scoreGlobal}.`
    });
  }

  return alerts;
}

export function isStaleDiagnostic(date: string, now = new Date()) {
  const diff = now.getTime() - new Date(date).getTime();
  return diff > 7 * 86_400_000;
}
