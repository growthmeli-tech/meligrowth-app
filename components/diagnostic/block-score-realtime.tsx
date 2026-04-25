"use client";

import { useEffect, useMemo, useState } from "react";
import { calcAdsScore, calcLogisticaScore, calcPublicacionesScore, calcSaludScore, calcStockScore } from "@/lib/scoring";
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

function safe(metricas: Record<string, number | null>, key: string) {
  return metricas[key] ?? 0;
}

function computeBlockScore(bloque: BlockScoreRealtimeProps["bloque"], metricas: Record<string, number | null>) {
  if (bloque === "01_salud") {
    return calcSaludScore({
      reclamos: safe(metricas, "reclamos"),
      mediaciones: safe(metricas, "mediaciones"),
      cancelaciones_vendedor: safe(metricas, "cancelaciones_vendedor"),
      envios_a_tiempo: safe(metricas, "envios_a_tiempo")
    });
  }

  if (bloque === "02_publicaciones") {
    return calcPublicacionesScore({
      pubs_activas_pct: safe(metricas, "pubs_activas_pct"),
      pubs_optimizadas_pct: safe(metricas, "pubs_optimizadas_pct"),
      ctr: safe(metricas, "ctr")
    });
  }

  if (bloque === "03_ads") {
    return calcAdsScore({
      margen_pre_ads: safe(metricas, "margen_pre_ads"),
      gasto_ads: safe(metricas, "gasto_ads"),
      ventas_ads: safe(metricas, "ventas_ads"),
      ventas_totales: safe(metricas, "ventas_totales"),
      acos: safe(metricas, "acos"),
      roas: safe(metricas, "roas"),
      tacos: safe(metricas, "tacos")
    });
  }

  if (bloque === "04_logistica") {
    return calcLogisticaScore({
      incidencias_pct: safe(metricas, "incidencias_pct"),
      uso_full_flex_pct: safe(metricas, "uso_full_flex_pct"),
      cancelaciones_stock_pct: safe(metricas, "cancelaciones_stock_pct")
    });
  }

  return calcStockScore({
    skus_sin_stock_pct: safe(metricas, "skus_sin_stock_pct"),
    dias_stock: safe(metricas, "dias_stock"),
    lead_time_reposicion: safe(metricas, "lead_time_reposicion"),
    sistema_reposicion: safe(metricas, "sistema_reposicion")
  });
}
