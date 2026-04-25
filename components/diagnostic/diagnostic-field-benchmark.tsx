"use client";

import { useMemo } from "react";
import { getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import type { RecommendationCategory } from "@/lib/recommendations/types";
import { calcScore } from "@/lib/scoring";
import { getScoreLabel, getScoreTailwind } from "@/lib/utils/scores";

type DiagnosticFieldBenchmarkProps = {
  name: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  metrica: string;
  dataSource?: "api" | "manual" | null;
  disabled?: boolean;
};

const METRIC_CATEGORY: Record<string, RecommendationCategory> = {
  reclamos: "salud",
  mediaciones: "salud",
  cancelaciones_vendedor: "salud",
  envios_a_tiempo: "salud",
  pubs_activas_pct: "publicaciones",
  pubs_optimizadas_pct: "publicaciones",
  ctr: "publicaciones",
  acos: "ads",
  roas: "ads",
  tacos: "ads",
  incidencias_pct: "logistica",
  uso_full_flex_pct: "logistica",
  cancelaciones_stock_pct: "logistica",
  skus_sin_stock_pct: "stock",
  dias_stock: "stock",
  lead_time_reposicion: "stock",
  sistema_reposicion: "stock"
};

export function DiagnosticFieldBenchmark({ name, label, value, onChange, metrica, dataSource = "manual", disabled = false }: DiagnosticFieldBenchmarkProps) {
  const normalizedValue = value ?? 0;
  const score = useMemo(() => calcScore(metrica, normalizedValue), [metrica, normalizedValue]);
  const status = getStatusFromScore(score);
  const category = METRIC_CATEGORY[metrica];
  const benchmark = category ? getBenchmarkDefinition(category, metrica) : null;
  const benchmarkLine = benchmark ? buildBenchmarkText(benchmark.levels) : "Sin benchmark definido";
  const isCritical = score < 40;

  return (
    <label className="space-y-2 rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-700">{label}</span>
        <DataSourceTag source={dataSource} />
      </div>
      <input
        name={name}
        aria-label={label}
        className="focus-ring h-11 w-full rounded-component border border-black/10 px-3 font-mono"
        min="0"
        step="0.01"
        type="number"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw.trim() === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getScoreTailwind(score)}`}>{getScoreLabel(score)}</span>
        <span className="text-xs text-zinc-600">Benchmark: {benchmarkLine}</span>
      </div>
      {benchmark?.lectura_practica ? <p className="text-xs text-zinc-500">{benchmark.lectura_practica}</p> : null}
      {isCritical ? <p className="text-xs font-semibold text-red-600">Valor fuera de umbral crítico para {status.replaceAll("_", " ")}.</p> : null}
    </label>
  );
}

function DataSourceTag({ source }: { source: "api" | "manual" | null }) {
  if (source === "api") return <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">API</span>;
  return <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">Manual</span>;
}

function buildBenchmarkText(levels: Array<{ maxValue?: number; minValue?: number; label: string }>) {
  const solid = levels.find((item) => item.label.toLowerCase().includes("solido"));
  const critical = levels.find((item) => item.label.toLowerCase().includes("critico"));
  const solidText = solid?.maxValue !== undefined ? `<${solid.maxValue}` : solid?.minValue !== undefined ? `>${solid.minValue}` : "sólido";
  const criticalText = critical?.minValue !== undefined ? `>${critical.minValue}` : critical?.maxValue !== undefined ? `<${critical.maxValue}` : "crítico";
  return `${solidText} sólido · ${criticalText} crítico`;
}
