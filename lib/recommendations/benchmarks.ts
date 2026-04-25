import type { RecommendationCategory, ScoreStatus } from "@/lib/recommendations/types";

type BenchmarkLevel = {
  score: number;
  label: string;
  maxValue?: number;
  minValue?: number;
};

export type MetricaBenchmarkDef = {
  metrica: string;
  unidad: "pct" | "x" | "dias" | "nivel";
  higherIsBetter: boolean;
  levels: BenchmarkLevel[];
  lectura_practica: string;
  como_obtenerlo: string;
};

export const BENCHMARKS: Record<RecommendationCategory, MetricaBenchmarkDef[]> = {
  salud: [
    {
      metrica: "reclamos",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 0.2 },
        { score: 95, label: "Platinum", maxValue: 0.4, minValue: 0.2 },
        { score: 85, label: "Solido", maxValue: 0.8, minValue: 0.4 },
        { score: 70, label: "En desarrollo", maxValue: 1.0, minValue: 0.8 },
        { score: 55, label: "En riesgo", maxValue: 1.5, minValue: 1.0 },
        { score: 15, label: "Critico", minValue: 1.5 }
      ],
      lectura_practica: "Referencia: <0.5% es buen estandar operativo.",
      como_obtenerlo: "Panel de reputacion -> resumen operativo."
    },
    {
      metrica: "mediaciones",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 0.05 },
        { score: 95, label: "Platinum", maxValue: 0.1, minValue: 0.05 },
        { score: 85, label: "Solido", maxValue: 0.2, minValue: 0.1 },
        { score: 70, label: "En desarrollo", maxValue: 0.4, minValue: 0.2 },
        { score: 55, label: "En riesgo", maxValue: 0.5, minValue: 0.4 },
        { score: 15, label: "Critico", minValue: 0.5 }
      ],
      lectura_practica: "Metrica sensible: cada caso suma riesgo reputacional.",
      como_obtenerlo: "Panel de reputacion."
    },
    {
      metrica: "cancelaciones_vendedor",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 0.05 },
        { score: 95, label: "Platinum", maxValue: 0.1, minValue: 0.05 },
        { score: 85, label: "Solido", maxValue: 0.2, minValue: 0.1 },
        { score: 70, label: "En desarrollo", maxValue: 0.4, minValue: 0.2 },
        { score: 55, label: "En riesgo", maxValue: 0.5, minValue: 0.4 },
        { score: 15, label: "Critico", minValue: 0.5 }
      ],
      lectura_practica: "Senal directa de desorden de stock o proceso.",
      como_obtenerlo: "Panel de reputacion o reportes operativos."
    },
    {
      metrica: "envios_a_tiempo",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 98.5 },
        { score: 95, label: "Platinum", minValue: 97, maxValue: 98.5 },
        { score: 85, label: "Solido", minValue: 95, maxValue: 97 },
        { score: 70, label: "En desarrollo", minValue: 92, maxValue: 95 },
        { score: 55, label: "En riesgo", minValue: 88, maxValue: 92 },
        { score: 15, label: "Critico", maxValue: 88 }
      ],
      lectura_practica: "Cada decima importa en reputacion ML.",
      como_obtenerlo: "Reputacion o modulo logistico."
    }
  ],
  publicaciones: [
    {
      metrica: "pubs_activas_pct",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 85 },
        { score: 95, label: "Platinum", minValue: 75, maxValue: 85 },
        { score: 85, label: "Solido", minValue: 65, maxValue: 75 },
        { score: 70, label: "En desarrollo", minValue: 40, maxValue: 65 },
        { score: 55, label: "En riesgo", minValue: 25, maxValue: 40 },
        { score: 15, label: "Critico", maxValue: 25 }
      ],
      lectura_practica: "Objetivo real: >75%.",
      como_obtenerlo: "Activas / total publicado."
    },
    {
      metrica: "pubs_optimizadas_pct",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 85 },
        { score: 95, label: "Platinum", minValue: 75, maxValue: 85 },
        { score: 85, label: "Solido", minValue: 60, maxValue: 75 },
        { score: 70, label: "En desarrollo", minValue: 40, maxValue: 60 },
        { score: 55, label: "En riesgo", minValue: 20, maxValue: 40 },
        { score: 15, label: "Critico", maxValue: 20 }
      ],
      lectura_practica: "Catalogo optimizado convierte mejor.",
      como_obtenerlo: "Top pubs auditadas con titulo+fotos+ficha."
    },
    {
      metrica: "ctr",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 3.5 },
        { score: 95, label: "Platinum", minValue: 2.5, maxValue: 3.5 },
        { score: 85, label: "Solido", minValue: 1.5, maxValue: 2.5 },
        { score: 70, label: "En desarrollo", minValue: 1.0, maxValue: 1.5 },
        { score: 55, label: "En riesgo", minValue: 0.7, maxValue: 1.0 },
        { score: 15, label: "Critico", maxValue: 0.7 }
      ],
      lectura_practica: "Cada 0.5% de CTR impacta en ventas.",
      como_obtenerlo: "Mercado Ads o reportes de trafico."
    }
  ],
  ads: [
    {
      metrica: "acos",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 6 },
        { score: 95, label: "Platinum", maxValue: 8, minValue: 6 },
        { score: 85, label: "Solido", maxValue: 12, minValue: 8 },
        { score: 70, label: "En desarrollo", maxValue: 15, minValue: 12 },
        { score: 55, label: "En riesgo", maxValue: 20, minValue: 15 },
        { score: 15, label: "Critico", minValue: 20 }
      ],
      lectura_practica: "Bajo es mejor. >15% erosiona margen.",
      como_obtenerlo: "Mercado Ads -> dashboard campanas."
    },
    {
      metrica: "roas",
      unidad: "x",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 8 },
        { score: 95, label: "Platinum", minValue: 6, maxValue: 8 },
        { score: 85, label: "Solido", minValue: 4, maxValue: 6 },
        { score: 70, label: "En desarrollo", minValue: 3, maxValue: 4 },
        { score: 55, label: "En riesgo", minValue: 1.5, maxValue: 3 },
        { score: 15, label: "Critico", maxValue: 1.5 }
      ],
      lectura_practica: "Alto es mejor. <4x frena escalado.",
      como_obtenerlo: "Mercado Ads -> dashboard campanas."
    },
    {
      metrica: "ventas_ads_pct",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 20, maxValue: 25 },
        { score: 95, label: "Platinum", minValue: 15, maxValue: 30 },
        { score: 85, label: "Solido", minValue: 10, maxValue: 35 },
        { score: 70, label: "En desarrollo", minValue: 5, maxValue: 40 },
        { score: 55, label: "En riesgo", minValue: 1, maxValue: 5 },
        { score: 15, label: "Critico", maxValue: 1 }
      ],
      lectura_practica: "Sweet spot 20-25%. Fuera de rango indica desbalance.",
      como_obtenerlo: "Ventas ads / ventas totales."
    }
  ],
  logistica: [
    {
      metrica: "incidencias_pct",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 0.3 },
        { score: 95, label: "Platinum", maxValue: 0.7, minValue: 0.3 },
        { score: 85, label: "Solido", maxValue: 1.5, minValue: 0.7 },
        { score: 70, label: "En desarrollo", maxValue: 2.5, minValue: 1.5 },
        { score: 55, label: "En riesgo", maxValue: 4, minValue: 2.5 },
        { score: 15, label: "Critico", minValue: 4 }
      ],
      lectura_practica: "Cada incidencia tiene costo oculto.",
      como_obtenerlo: "Reporte operativo o reputacion."
    },
    {
      metrica: "uso_full_flex_pct",
      unidad: "pct",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 80 },
        { score: 95, label: "Platinum", minValue: 70, maxValue: 80 },
        { score: 85, label: "Solido", minValue: 50, maxValue: 70 },
        { score: 70, label: "En desarrollo", minValue: 30, maxValue: 50 },
        { score: 55, label: "En riesgo", minValue: 15, maxValue: 30 },
        { score: 15, label: "Critico", maxValue: 15 }
      ],
      lectura_practica: "Objetivo real >70%.",
      como_obtenerlo: "Pedidos Full/Flex / pedidos totales."
    },
    {
      metrica: "cancelaciones_stock_pct",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 0.2 },
        { score: 95, label: "Platinum", maxValue: 0.4, minValue: 0.2 },
        { score: 85, label: "Solido", maxValue: 0.8, minValue: 0.4 },
        { score: 70, label: "En desarrollo", maxValue: 1.5, minValue: 0.8 },
        { score: 55, label: "En riesgo", maxValue: 3, minValue: 1.5 },
        { score: 15, label: "Critico", minValue: 3 }
      ],
      lectura_practica: "Senal operativa directa.",
      como_obtenerlo: "Conciliacion de cancelaciones."
    }
  ],
  stock: [
    {
      metrica: "skus_sin_stock_pct",
      unidad: "pct",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 1 },
        { score: 95, label: "Platinum", maxValue: 2, minValue: 1 },
        { score: 85, label: "Solido", maxValue: 5, minValue: 2 },
        { score: 70, label: "En desarrollo", maxValue: 8, minValue: 5 },
        { score: 55, label: "En riesgo", maxValue: 15, minValue: 8 },
        { score: 15, label: "Critico", minValue: 15 }
      ],
      lectura_practica: "Objetivo <2% sostenido.",
      como_obtenerlo: "Exportar catalogo -> sin stock / total."
    },
    {
      metrica: "dias_stock",
      unidad: "dias",
      higherIsBetter: true,
      levels: [
        { score: 100, label: "Perfecto", minValue: 20, maxValue: 35 },
        { score: 95, label: "Platinum", minValue: 15, maxValue: 45 },
        { score: 85, label: "Solido", minValue: 10, maxValue: 60 },
        { score: 70, label: "En desarrollo", minValue: 7, maxValue: 75 },
        { score: 55, label: "En riesgo", minValue: 5, maxValue: 90 },
        { score: 15, label: "Critico", maxValue: 5 }
      ],
      lectura_practica: "Centro de rango = perfecto. Extremos = riesgo.",
      como_obtenerlo: "Stock actual / (ventas 30d / 30)."
    },
    {
      metrica: "lead_time_reposicion",
      unidad: "dias",
      higherIsBetter: false,
      levels: [
        { score: 100, label: "Perfecto", maxValue: 3 },
        { score: 95, label: "Platinum", maxValue: 5, minValue: 3 },
        { score: 85, label: "Solido", maxValue: 10, minValue: 5 },
        { score: 70, label: "En desarrollo", maxValue: 15, minValue: 10 },
        { score: 55, label: "En riesgo", maxValue: 25, minValue: 15 },
        { score: 15, label: "Critico", minValue: 25 }
      ],
      lectura_practica: "A menor lead time, mayor control operativo.",
      como_obtenerlo: "Circuito de compras/reposicion."
    }
  ]
};

const STATUS_BY_SCORE: ScoreStatus[] = ["critico", "en_riesgo", "en_desarrollo", "solido", "muy_bueno", "platinum"];

export function benchmarkToObjective(def: MetricaBenchmarkDef): string {
  const platinum = def.levels.find((level) => level.score === 95) ?? def.levels.find((level) => level.score === 100);
  if (!platinum) return "Sin objetivo";
  if (platinum.minValue !== undefined && platinum.maxValue !== undefined) return `${platinum.minValue}-${platinum.maxValue}`;
  if (platinum.minValue !== undefined) return `>${platinum.minValue}`;
  if (platinum.maxValue !== undefined) return `<${platinum.maxValue}`;
  return platinum.label;
}

export function getBenchmarkDefinition(categoria: RecommendationCategory, metrica: string) {
  return BENCHMARKS[categoria].find((item) => item.metrica === metrica) ?? null;
}

export function getStatusFromScore(score: number): ScoreStatus {
  if (score >= 95) return STATUS_BY_SCORE[5];
  if (score >= 85) return STATUS_BY_SCORE[4];
  if (score >= 70) return STATUS_BY_SCORE[3];
  if (score >= 55) return STATUS_BY_SCORE[2];
  if (score >= 40) return STATUS_BY_SCORE[1];
  return STATUS_BY_SCORE[0];
}
