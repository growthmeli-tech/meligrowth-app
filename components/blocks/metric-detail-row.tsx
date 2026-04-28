import { ACCIONES_POR_METRICA } from "@/lib/recommendations/actions";
import { BENCHMARKS, getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import { calcScore } from "@/lib/scoring";
import { DESIGN_TOKENS } from "@/lib/config/design-tokens";
import { getScoreLabel, getScoreStatus } from "@/lib/utils/scores";

type BenchmarkCategory = keyof typeof BENCHMARKS;

export type MetricDetailRowProps = {
  metrica: string;
  label: string;
  valor: number | null;
  source: "api" | "manual" | null;
  benchmarkKey: string;
};

export function MetricDetailRow({ metrica, label, valor, source, benchmarkKey }: MetricDetailRowProps) {
  const [category, metricName] = parseBenchmarkKey(benchmarkKey);
  const benchmark = category ? getBenchmarkDefinition(category, metricName || metrica) : null;
  const score = typeof valor === "number" ? calcScore(metrica, valor) : null;
  const status = typeof score === "number" ? getStatusFromScore(score) : null;
  const action = status ? ACCIONES_POR_METRICA[metrica]?.[status] ?? "Revisar esta métrica con el equipo operativo." : null;
  const scoreStatusKey = typeof score === "number" ? getScoreStatus(score) : null;
  const progressColor = scoreStatusKey ? DESIGN_TOKENS.score[scoreStatusKey].color : "#E8E8E2";

  return (
    <article className="rounded-xl border border-[#E8E8E2] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
          <p className="mt-1 text-xs text-[#6B6B6B]">{benchmark ? formatBenchmarkLine(benchmark.levels) : "Sin benchmark definido"}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-[#1A1A1A]">{formatValue(valor, benchmark?.unidad ?? "pct")}</p>
          <p className="mt-1 text-xs text-[#6B6B6B]">{sourceLabel(source)}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full rounded-full bg-[#F0F0EC]">
          <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${score ?? 0}%`, backgroundColor: progressColor }} />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm font-semibold text-[#1A1A1A]">
          {status ? `● ${getScoreLabel(score ?? 0)}` : "✏️ Sin datos"}
        </p>
        {status ? <p className="text-xs text-[#6B6B6B]">Acción: {action}</p> : <p className="text-xs text-[#6B6B6B]">Acción: {benchmark?.como_obtenerlo ?? "Ingresar dato manualmente."}</p>}
      </div>
    </article>
  );
}

function parseBenchmarkKey(raw: string): [BenchmarkCategory | null, string | null] {
  const [category, metric] = raw.split(".");
  if (!category || !metric) return [null, null];
  if (!(category in BENCHMARKS)) return [null, null];
  return [category as BenchmarkCategory, metric];
}

function formatValue(value: number | null, unit: "pct" | "x" | "dias" | "nivel") {
  if (value === null || Number.isNaN(value)) return "--";
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "dias") return `${value.toFixed(1)} días`;
  if (unit === "nivel") return `${value.toFixed(0)}`;
  return `${value.toFixed(2)}%`;
}

function sourceLabel(source: "api" | "manual" | null) {
  if (source === "api") return "🟢 API";
  if (source === "manual") return "✏️ Manual";
  return "-- Sin datos";
}

function formatBenchmarkLine(levels: Array<{ maxValue?: number; minValue?: number; label: string }>) {
  const perfect = levels.find((item) => item.label.toLowerCase().includes("perfecto"));
  const solid = levels.find((item) => item.label.toLowerCase().includes("solido"));
  const critical = levels.find((item) => item.label.toLowerCase().includes("critico"));

  const perfectText = perfect?.maxValue !== undefined ? `<${perfect.maxValue}` : perfect?.minValue !== undefined ? `>${perfect.minValue}` : "perfecto";
  const solidText = solid?.maxValue !== undefined ? `<${solid.maxValue}` : solid?.minValue !== undefined ? `>${solid.minValue}` : "sólido";
  const criticalText =
    critical?.minValue !== undefined ? `>${critical.minValue}` : critical?.maxValue !== undefined ? `<${critical.maxValue}` : "crítico";

  return `Benchmark: ${perfectText} perfecto · ${solidText} sólido · ${criticalText} crítico`;
}
