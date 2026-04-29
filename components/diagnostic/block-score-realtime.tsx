"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calcAdsScoreFromMetricSnapshot,
  calcLogisticaScoreFromSnapshot,
  calcPublicacionesScoreFromSnapshot,
  calcSaludScoreFromSnapshot,
  calcStockScoreFromSnapshot,
  metricSnapshotFromManualFormValues
} from "@/lib/scoring/metric-snapshot";
import { getScoreLabel, getScoreTailwind } from "@/lib/utils/scores";

type BlockScoreRealtimeProps = {
  bloque: "01_salud" | "02_publicaciones" | "03_ads" | "04_logistica" | "05_stock";
  metricas: Record<string, number | null>;
  peso: number;
};

export function BlockScoreRealtime({ bloque, metricas, peso }: BlockScoreRealtimeProps) {
  const computed = useMemo(() => computeBlockScore(bloque, metricas), [bloque, metricas]);
  const [score, setScore] = useState(computed);

  useEffect(() => {
    const timeout = window.setTimeout(() => setScore(computed), 300);
    return () => window.clearTimeout(timeout);
  }, [computed]);

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{bloque.replace("_", " ")}</p>
        <p className="text-xs text-zinc-500">Peso {peso}%</p>
      </div>
      <p className="mt-2 font-mono text-3xl font-black">{score}</p>
      <div className="mt-2 h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-brand-purple transition-all duration-500" style={{ width: `${score}%` }} />
      </div>
      <p className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getScoreTailwind(score)}`}>{getScoreLabel(score)}</p>
    </div>
  );
}

function computeBlockScore(bloque: BlockScoreRealtimeProps["bloque"], metricas: Record<string, number | null>) {
  const snap = metricSnapshotFromManualFormValues(metricas);

  if (bloque === "01_salud") {
    return calcSaludScoreFromSnapshot(snap);
  }

  if (bloque === "02_publicaciones") {
    return calcPublicacionesScoreFromSnapshot(snap);
  }

  if (bloque === "03_ads") {
    return calcAdsScoreFromMetricSnapshot(snap);
  }

  if (bloque === "04_logistica") {
    return calcLogisticaScoreFromSnapshot(snap);
  }

  return calcStockScoreFromSnapshot(snap);
}
