import type { BloqueScores, BlockKey, Decision, DiagnosticInput, Estado } from "@/lib/types";
import { calcBloqueScores, calcScoreGlobal } from "@/lib/scoring/block-calculations";

export function getEstado(score: number): Estado {
  if (score >= 95) return "platinum";
  if (score >= 85) return "solido";
  if (score >= 70) return "desarrollo";
  if (score >= 55) return "riesgo";
  return "critico";
}

export function getDecision(estado: Estado, bloques: BloqueScores): Decision {
  const entries = Object.entries(bloques) as Array<[BlockKey, number]>;
  const [block, score] = entries.sort((a, b) => a[1] - b[1])[0];
  const priority = estado === "critico" || score < 55 ? "urgente" : estado === "riesgo" ? "alta" : "media";

  const titles: Record<BlockKey, string> = {
    salud: "Proteger reputación y SLA",
    publicaciones: "Recuperar calidad de publicaciones",
    ads: "Ajustar inversión publicitaria",
    logistica: "Reducir fricción logística",
    stock: "Asegurar disponibilidad rentable"
  };

  return {
    title: titles[block],
    description: `El bloque más débil es ${block} con ${score} puntos. Priorizar acciones de impacto semanal antes de abrir iniciativas nuevas.`,
    priority,
    block
  };
}

export function scoreDiagnostic(input: DiagnosticInput, options?: { hasAdsData?: boolean }) {
  const scores = calcBloqueScores(input);
  const scoreGlobal = calcScoreGlobal(scores, options);
  const estado = getEstado(scoreGlobal);
  return {
    scores,
    scoreGlobal,
    estadoGlobal: estado,
    decision: getDecision(estado, scores)
  };
}
