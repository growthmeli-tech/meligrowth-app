"use client";

import { useEffect, useMemo, useState } from "react";
import { benchmarkToObjective, getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import type { RecommendationCategory } from "@/lib/recommendations/types";
import { calcScore } from "@/lib/scoring";
import { getScoreLabel } from "@/lib/utils/scores";
import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";

export type DiagnosticFieldBenchmarkProps = {
  name: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  metrica: string;
  dataSource?: "api" | "scraper" | "manual" | "unavailable" | null;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
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

export function DiagnosticFieldBenchmark({
  name,
  label,
  value,
  onChange,
  metrica,
  dataSource = "manual",
  disabled = false,
  loading = false,
  error = null
}: DiagnosticFieldBenchmarkProps) {
  const [draftValue, setDraftValue] = useState(value === null ? "" : String(value));
  const [score, setScore] = useState(() => calcScore(metrica, value ?? 0));
  const [showAction, setShowAction] = useState(false);

  useEffect(() => {
    setDraftValue(value === null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const parsed = Number(draftValue);
      const nextValue = draftValue.trim() === "" || Number.isNaN(parsed) ? 0 : parsed;
      setScore(calcScore(metrica, nextValue));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [draftValue, metrica]);

  const status = getStatusFromScore(score);
  const scoreTone = DESIGN_TOKENS.score[status as ScoreStatusKey];
  const category = METRIC_CATEGORY[metrica];
  const benchmark = category ? getBenchmarkDefinition(category, metrica) : null;
  const benchmarkLine = benchmark ? buildBenchmarkText(benchmark.levels) : "Sin benchmark definido";
  const objective = benchmark ? benchmarkToObjective(benchmark) : "Sin objetivo";

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
        <div className="h-11 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
        <DataSourceTag source={dataSource} />
      </div>

      <input
        name={name}
        aria-label={label}
        className={`w-full h-11 rounded-lg border border-[#E8E8E2] bg-white px-3 text-sm font-mono tabular-nums text-[#1A1A1A] focus:border-2 focus:border-[#FFD600] focus:outline-none hover:border-gray-300 ${error ? "border-red-500 text-red-700" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        min="0"
        step="0.01"
        type="number"
        value={draftValue}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          setDraftValue(raw);
          if (raw.trim() === "") return onChange(null);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
        onBlur={() => setShowAction(true)}
      />

      {draftValue.trim() === "" ? (
        <p className="text-xs text-[#6B6B6B]">Ingresa un valor para comparar con benchmark</p>
      ) : (
        <>
          <p className="text-sm font-medium" style={{ color: scoreTone.color }}>
            {getScoreLabel(score)}
          </p>
          <p className="text-xs text-[#6B6B6B]">{`Benchmark: ${benchmarkLine}`}</p>
          <p className="text-xs font-medium text-[#6B6B6B]">{`Objetivo: llevar a ${objective}`}</p>
          {showAction && benchmark?.lectura_practica ? <p className="text-xs text-[#6B6B6B]">{benchmark.lectura_practica}</p> : null}
        </>
      )}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </label>
  );
}

function DataSourceTag({ source }: { source: "api" | "scraper" | "manual" | "unavailable" | null }) {
  if (source === "api") {
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">🟢 API</span>;
  }

  if (source === "scraper") {
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">✏️ Manual</span>;
  }

  if (source === "unavailable") {
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">✏️ Manual</span>;
  }

  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">✏️ Manual</span>;
}

function buildBenchmarkText(levels: Array<{ maxValue?: number; minValue?: number; label: string }>) {
  const solid = levels.find((item) => item.label.toLowerCase().includes("solido"));
  const critical = levels.find((item) => item.label.toLowerCase().includes("critico"));
  const solidText = solid?.maxValue !== undefined ? `<${solid.maxValue}` : solid?.minValue !== undefined ? `>${solid.minValue}` : "sólido";
  const criticalText = critical?.minValue !== undefined ? `>${critical.minValue}` : critical?.maxValue !== undefined ? `<${critical.maxValue}` : "crítico";
  return `${solidText} sólido · ${criticalText} crítico`;
}
