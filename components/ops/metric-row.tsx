"use client";

import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";
import { cn } from "@/lib/utils";
import { getScoreStatus } from "@/lib/utils/scores";

export type MetricRowProps = {
  label: string;
  valor: number | null;
  unidad: "%" | "x" | "días" | "nivel";
  score: number;
  estado: string;
  benchmark: string;
  accion: string;
  source: "api" | "manual" | null;
  esCritica: boolean;
};

export function MetricRow({ label, valor, unidad, score, estado, benchmark, accion, source, esCritica }: MetricRowProps) {
  const status = getScoreStatus(score) as ScoreStatusKey;
  const tone = DESIGN_TOKENS.score[status];
  const progress = `${Math.max(0, Math.min(100, score))}%`;
  const sourceLabel = source === "api" ? "🟢 API" : source === "manual" ? "✏️ Manual" : "-- Sin datos";

  return (
    <article className={cn("rounded-xl border border-[#E8E8E2] bg-white p-4 shadow-sm", esCritica && score < 40 ? "border-red-300" : "")}>
      <header className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#E8E8E2] px-2 py-0.5 text-[11px] font-semibold text-[#6B6B6B]">{sourceLabel}</span>
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: tone.color, borderColor: tone.border, backgroundColor: tone.bg }}
          >
            {estado}
          </span>
        </div>
      </header>

      <p className="mt-3 text-3xl font-black text-[#1A1A1A]">
        {valor === null ? "Sin datos" : formatMetricValue(valor, unidad)}
      </p>

      <div className="mt-2">
        <div className="h-2 overflow-hidden rounded-full bg-[#E8E8E2]">
          <div className="h-2 rounded-full" style={{ width: progress, backgroundColor: tone.color }} />
        </div>
        <p className="mt-1 text-xs font-semibold text-[#6B6B6B]">{`${score}/100`}</p>
      </div>

      <p className="mt-3 text-xs text-[#6B6B6B]">{`Benchmark: ${benchmark}`}</p>
      <p className={cn("mt-2 text-sm font-medium", score < 55 ? "text-[#B91C1C]" : "text-[#1A1A1A]")}>{accion}</p>
    </article>
  );
}

function formatMetricValue(value: number, unit: MetricRowProps["unidad"]) {
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "días") return `${value.toFixed(1)} días`;
  if (unit === "nivel") return `Nivel ${value.toFixed(0)}`;
  return `${value.toFixed(1)}%`;
}
