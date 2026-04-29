"use client";

import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";
import type { MlDataSource } from "@/lib/ml/mappers/types";
import { getMetricSourceBadge } from "@/lib/ops/data-source-ui";
import type { OpsMetricRowData } from "@/lib/ops/metrics";
import { cn } from "@/lib/utils";
import { getScoreStatus } from "@/lib/utils/scores";

export type MetricRowProps = {
  label: string;
  valor: number | null;
  unidad: OpsMetricRowData["unit"];
  score: number | null;
  estado: string;
  benchmark: string;
  accion: string;
  source: MlDataSource | null;
  esCritica: boolean;
  rowKind?: OpsMetricRowData["rowKind"];
};

export function MetricRow({ label, valor, unidad, score, estado, benchmark, accion, source, esCritica, rowKind }: MetricRowProps) {
  const measured = score !== null && !Number.isNaN(score);
  const status = measured ? (getScoreStatus(score) as ScoreStatusKey) : null;
  const tone = status ? DESIGN_TOKENS.score[status] : null;
  const progress = measured ? `${Math.max(0, Math.min(100, score))}%` : "0%";
  const sourceBadge = getMetricSourceBadge(source);
  const treatAsRisk = measured && esCritica && score < 40;
  const neutralMissing = !measured;

  return (
    <article
      className={cn(
        "rounded-xl border border-[#E8E8E2] bg-white p-4 shadow-sm",
        treatAsRisk && "border-red-300",
        neutralMissing && "border-dashed border-slate-200 bg-slate-50/40"
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", sourceBadge.className)}
            title={sourceBadge.title}
          >
            {sourceBadge.label}
          </span>
          {measured ? (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: tone?.color, borderColor: tone?.border, backgroundColor: tone?.bg }}
            >
              {estado}
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">{estado}</span>
          )}
        </div>
      </header>

      <p className="mt-3 text-3xl font-black text-[#1A1A1A]">{valor === null ? "—" : formatMetricValue(valor, unidad)}</p>

      <div className="mt-2">
        <div className={cn("h-2 overflow-hidden rounded-full", neutralMissing ? "border border-dashed border-slate-200 bg-white" : "bg-[#E8E8E2]")}>
          {measured ? (
            <div className="h-2 rounded-full" style={{ width: progress, backgroundColor: tone?.color ?? "#94a3b8" }} />
          ) : (
            <div className="h-2 w-0 rounded-full bg-transparent" />
          )}
        </div>
        <p className="mt-1 text-xs font-semibold text-[#6B6B6B]">{measured ? `${Math.round(score)}/100` : "Sin score (sin dato o no aplica)"}</p>
      </div>

      <p className="mt-3 text-xs text-[#6B6B6B]">{`Benchmark: ${benchmark}`}</p>
      <p
        className={cn(
          "mt-2 text-sm font-medium",
          measured && score < 55 ? "text-[#B91C1C]" : "text-[#1A1A1A]",
          rowKind === "optional_absent" && "text-[#4B5563]"
        )}
      >
        {accion}
      </p>
    </article>
  );
}

function formatMetricValue(value: number, unit: MetricRowProps["unidad"]) {
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "días") return `${value.toFixed(1)} días`;
  if (unit === "nivel") return `Nivel ${value.toFixed(0)}`;
  return `${value.toFixed(1)}%`;
}
