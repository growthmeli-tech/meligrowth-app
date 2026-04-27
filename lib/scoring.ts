import type {
  AdsData,
  BloqueScores,
  BlockKey,
  Decision,
  DiagnosticInput,
  Estado,
  LogisticaData,
  PublicacionesData,
  SaludData,
  StockData
} from "@/lib/types";

type Direction = "higher" | "lower" | "range";

type Benchmark = {
  direction: Direction;
  platinum: number;
  solid: number;
  development: number;
  risk: number;
  idealMin?: number;
  idealMax?: number;
};

const benchmarks: Record<string, Benchmark> = {
  reclamos: { direction: "lower", platinum: 0.5, solid: 1, development: 2, risk: 4 },
  mediaciones: { direction: "lower", platinum: 0.2, solid: 0.5, development: 1, risk: 2 },
  cancelaciones_vendedor: { direction: "lower", platinum: 0.5, solid: 1, development: 2, risk: 4 },
  envios_a_tiempo: { direction: "higher", platinum: 98, solid: 95, development: 90, risk: 85 },
  pubs_activas_pct: { direction: "higher", platinum: 95, solid: 85, development: 70, risk: 55 },
  pubs_optimizadas_pct: { direction: "higher", platinum: 90, solid: 80, development: 65, risk: 50 },
  ctr: { direction: "higher", platinum: 4, solid: 3, development: 2, risk: 1 },
  acos: { direction: "lower", platinum: 8, solid: 12, development: 18, risk: 25 },
  roas: { direction: "higher", platinum: 10, solid: 7, development: 4, risk: 2 },
  tacos: { direction: "lower", platinum: 5, solid: 8, development: 12, risk: 18 },
  incidencias_pct: { direction: "lower", platinum: 1, solid: 2, development: 4, risk: 7 },
  uso_full_flex_pct: { direction: "higher", platinum: 85, solid: 70, development: 50, risk: 30 },
  cancelaciones_stock_pct: { direction: "lower", platinum: 0.5, solid: 1, development: 2, risk: 4 },
  skus_sin_stock_pct: { direction: "lower", platinum: 3, solid: 7, development: 12, risk: 20 },
  dias_stock: { direction: "range", platinum: 95, solid: 85, development: 70, risk: 55, idealMin: 21, idealMax: 45 },
  lead_time_reposicion: { direction: "lower", platinum: 3, solid: 7, development: 14, risk: 21 },
  sistema_reposicion: { direction: "higher", platinum: 90, solid: 75, development: 50, risk: 25 }
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function interpolate(value: number, points: Array<[number, number]>) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    if ((value >= x1 && value <= x2) || (value <= x1 && value >= x2)) {
      const progress = (value - x1) / (x2 - x1);
      return clamp(y1 + progress * (y2 - y1));
    }
  }
  return clamp(points[points.length - 1][1]);
}

export function calcScore(metrica: string, valor: number): number {
  const benchmark = benchmarks[metrica];
  if (!benchmark || Number.isNaN(valor)) return 0;

  if (benchmark.direction === "higher") {
    if (valor >= benchmark.platinum) return 100;
    return Math.round(
      interpolate(valor, [
        [benchmark.platinum, 96],
        [benchmark.solid, 86],
        [benchmark.development, 72],
        [benchmark.risk, 56],
        [0, 20]
      ])
    );
  }

  if (benchmark.direction === "lower") {
    if (valor <= benchmark.platinum) return 100;
    return Math.round(
      interpolate(valor, [
        [benchmark.platinum, 96],
        [benchmark.solid, 86],
        [benchmark.development, 72],
        [benchmark.risk, 56],
        [benchmark.risk * 1.8, 20]
      ])
    );
  }

  const idealMin = benchmark.idealMin ?? 0;
  const idealMax = benchmark.idealMax ?? 0;
  if (valor >= idealMin && valor <= idealMax) return 100;
  const distance = valor < idealMin ? idealMin - valor : valor - idealMax;
  return clamp(Math.round(100 - distance * 3));
}

function weightedAverage(parts: Array<[number, number]>) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  return Math.round(parts.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight);
}

function capWhenCritical(score: number, metricScores: number[]) {
  return metricScores.some((metricScore) => metricScore < 45) ? Math.min(score, 55) : score;
}

export function getGlobalScoreWeights(hasAdsData = true) {
  if (hasAdsData) {
    return {
      salud: 35,
      publicaciones: 20,
      ads: 20,
      logistica: 15,
      stock: 10
    } as const;
  }

  return {
    salud: 43.75,
    publicaciones: 25,
    ads: 0,
    logistica: 18.75,
    stock: 12.5
  } as const;
}

export function calcSaludScore(data: SaludData): number {
  const scores = [
    calcScore("reclamos", data.reclamos),
    calcScore("mediaciones", data.mediaciones),
    calcScore("cancelaciones_vendedor", data.cancelaciones_vendedor),
    calcScore("envios_a_tiempo", data.envios_a_tiempo)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 30], [scores[1], 20], [scores[2], 25], [scores[3], 25]]), scores);
}

export function calcPublicacionesScore(data: PublicacionesData): number {
  const scores = [
    calcScore("pubs_activas_pct", data.pubs_activas_pct),
    calcScore("pubs_optimizadas_pct", data.pubs_optimizadas_pct),
    calcScore("ctr", data.ctr)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 35], [scores[1], 45], [scores[2], 20]]), scores);
}

export function calcAdsScore(data: AdsData): number {
  const scores = [calcScore("acos", data.acos), calcScore("roas", data.roas), calcScore("tacos", data.tacos)];
  const base = weightedAverage([[scores[0], 45], [scores[1], 30], [scores[2], 25]]);
  const profitabilityCap = data.acos > data.margen_pre_ads * 0.36 ? 55 : base;
  return capWhenCritical(profitabilityCap, scores);
}

export function calcLogisticaScore(data: LogisticaData): number {
  const scores = [
    calcScore("incidencias_pct", data.incidencias_pct),
    calcScore("uso_full_flex_pct", data.uso_full_flex_pct),
    calcScore("cancelaciones_stock_pct", data.cancelaciones_stock_pct)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 35], [scores[1], 40], [scores[2], 25]]), scores);
}

export function calcStockScore(data: StockData): number {
  const scores = [
    calcScore("skus_sin_stock_pct", data.skus_sin_stock_pct),
    calcScore("dias_stock", data.dias_stock),
    calcScore("lead_time_reposicion", data.lead_time_reposicion),
    calcScore("sistema_reposicion", data.sistema_reposicion)
  ];
  return capWhenCritical(weightedAverage([[scores[0], 35], [scores[1], 25], [scores[2], 20], [scores[3], 20]]), scores);
}

export function calcBloqueScores(input: DiagnosticInput): BloqueScores {
  return {
    salud: calcSaludScore(input.salud),
    publicaciones: calcPublicacionesScore(input.publicaciones),
    ads: calcAdsScore(input.ads),
    logistica: calcLogisticaScore(input.logistica),
    stock: calcStockScore(input.stock)
  };
}

export function calcBloqueScore(bloque: { key: BlockKey; data: DiagnosticInput[BlockKey] }): number {
  if (bloque.key === "salud") return calcSaludScore(bloque.data as SaludData);
  if (bloque.key === "publicaciones") return calcPublicacionesScore(bloque.data as PublicacionesData);
  if (bloque.key === "ads") return calcAdsScore(bloque.data as AdsData);
  if (bloque.key === "logistica") return calcLogisticaScore(bloque.data as LogisticaData);
  return calcStockScore(bloque.data as StockData);
}

export function calcScoreGlobal(bloques: BloqueScores, options?: { hasAdsData?: boolean }): number {
  const weights = getGlobalScoreWeights(options?.hasAdsData ?? true);

  return weightedAverage([
    [bloques.salud, weights.salud],
    [bloques.publicaciones, weights.publicaciones],
    [bloques.ads, weights.ads],
    [bloques.logistica, weights.logistica],
    [bloques.stock, weights.stock]
  ]);
}

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
  return {
    scores,
    scoreGlobal,
    estadoGlobal: getEstado(scoreGlobal),
    decision: getDecision(getEstado(scoreGlobal), scores)
  };
}
