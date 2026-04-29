"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { updateBlockMetrics } from "@/app/(internal)/internal/clients/[id]/actions";
import { ACCIONES_POR_METRICA } from "@/lib/recommendations/actions";
import { BENCHMARKS, getBenchmarkDefinition, getStatusFromScore } from "@/lib/recommendations/benchmarks";
import { calcScore } from "@/lib/scoring";
import { DESIGN_TOKENS } from "@/lib/config/design-tokens";
import { getScoreLabel, getScoreStatus } from "@/lib/utils/scores";
import type { Database } from "@/lib/supabase/database.types";
import type { InternalBlockSlug } from "@/lib/internal/block-metrics-scope";
import { cn } from "@/lib/utils";

type BenchmarkCategory = keyof typeof BENCHMARKS;
type MetricSnapshotInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

export type BlockMetricRowModel = {
  metrica: string;
  label: string;
  benchmarkKey: string;
  valor: number | null;
  /** Snapshot column written on save; ventas_ads_pct derives ventas_ads */
  column: keyof MetricSnapshotInsert | "ventas_ads_pct";
};

type BlockMetricsEditorProps = {
  mlAccountId: string;
  block: InternalBlockSlug;
  rows: BlockMetricRowModel[];
  blockSource: "api" | "manual" | null;
  /** Needed when editing % ventas por ads */
  ventasTotales: number | null;
};

function parseNumericInput(raw: string): number | null {
  const t = raw.replace(",", ".").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseBenchmarkKey(raw: string): [BenchmarkCategory | null, string | null] {
  const [category, metric] = raw.split(".");
  if (!category || !metric) return [null, null];
  if (!(category in BENCHMARKS)) return [null, null];
  return [category as BenchmarkCategory, metric];
}

function formatDisplay(value: number | null, unit: "pct" | "x" | "dias" | "nivel") {
  if (value === null || Number.isNaN(value)) return "Sin datos";
  if (unit === "x") return `${value.toFixed(2)}x`;
  if (unit === "dias") return `${value.toFixed(1)} días`;
  if (unit === "nivel") return `${value.toFixed(0)}`;
  return `${value.toFixed(2)}%`;
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

function sourceLabel(source: "api" | "manual" | null) {
  if (source === "api") return "🟢 API";
  if (source === "manual") return "Manual";
  return "Sin datos";
}

export function BlockMetricsEditor({ mlAccountId, block, rows, blockSource, ventasTotales }: BlockMetricsEditorProps) {
  const [manualMetrics, setManualMetrics] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();

  const displayVal = (row: BlockMetricRowModel) =>
    row.metrica in overrides ? overrides[row.metrica] : row.valor;

  const rowSource = (metrica: string): "api" | "manual" | null => {
    if (manualMetrics.has(metrica)) return "manual";
    return blockSource;
  };

  const beginEdit = (row: BlockMetricRowModel) => {
    const v = displayVal(row);
    setEditingKey(row.metrica);
    setDraft(v === null || Number.isNaN(v) ? "" : String(v));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft("");
  };

  const saveEdit = (row: BlockMetricRowModel) => {
    start(async () => {
      const parsed = parseNumericInput(draft);
      if (parsed === null && draft.trim() !== "") {
        window.alert("Valor numerico invalido");
        return;
      }

      let payload: Partial<MetricSnapshotInsert> = {};

      if (row.column === "ventas_ads_pct") {
        if (ventasTotales === null || ventasTotales <= 0) {
          window.alert("Necesitamos ventas totales en el snapshot para calcular este porcentaje.");
          return;
        }
        if (parsed === null) {
          window.alert("Ingresá un porcentaje valido.");
          return;
        }
        payload = { ventas_ads: (parsed / 100) * ventasTotales };
      } else if (parsed === null) {
        payload = { [row.column]: null } as Partial<MetricSnapshotInsert>;
      } else {
        payload = { [row.column]: parsed } as Partial<MetricSnapshotInsert>;
      }

      const res = await updateBlockMetrics(mlAccountId, block, payload);
      if (!res.success) {
        window.alert(res.error);
        return;
      }

      setOverrides((o) => ({ ...o, [row.metrica]: parsed }));
      setManualMetrics((m) => new Set(m).add(row.metrica));
      setEditingKey(null);
      setDraft("");
    });
  };

  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Métricas detalladas</p>
      {rows.map((row) => {
        const valor = displayVal(row);
        const [category, metricName] = parseBenchmarkKey(row.benchmarkKey);
        const benchmark = category ? getBenchmarkDefinition(category, metricName || row.metrica) : null;
        const score = typeof valor === "number" ? calcScore(row.metrica, valor) : null;
        const status = typeof score === "number" ? getStatusFromScore(score) : null;
        const action = status ? ACCIONES_POR_METRICA[row.metrica]?.[status] ?? "Revisar esta métrica con el equipo operativo." : null;
        const scoreStatusKey = typeof score === "number" ? getScoreStatus(score) : null;
        const progressColor = scoreStatusKey ? DESIGN_TOKENS.score[scoreStatusKey].color : "#E8E8E2";
        const unit = benchmark?.unidad ?? "pct";
        const src = rowSource(row.metrica);

        return (
          <article key={row.metrica} className="rounded-xl border border-[#E8E8E2] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">{row.label}</p>
                <p className="mt-1 text-xs text-[#6B6B6B]">{benchmark ? formatBenchmarkLine(benchmark.levels) : "Sin benchmark definido"}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {editingKey === row.metrica ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      className="w-36 rounded-lg border border-[#E8E8E2] px-2 py-1 font-mono text-sm"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      aria-label={`Editar ${row.label}`}
                    />
                    <button type="button" className="rounded-lg bg-[#FFD600] px-3 py-1 text-xs font-semibold text-[#1A1A1A]" onClick={() => saveEdit(row)}>
                      Guardar
                    </button>
                    <button type="button" className="text-xs font-semibold text-zinc-600 hover:text-[#1A1A1A]" onClick={cancelEdit}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-[#1A1A1A]">{formatDisplay(valor, unit)}</p>
                    <button
                      type="button"
                      className="rounded p-1 text-zinc-500 hover:bg-[#F5F5F0] hover:text-[#1A1A1A]"
                      aria-label={`Editar ${row.label}`}
                      onClick={() => beginEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <p className="mt-1 text-xs text-[#6B6B6B]">{sourceLabel(src)}</p>
                  {src === "manual" ? (
                    <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      Manual
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-[#F0F0EC]">
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${score ?? 0}%`, backgroundColor: progressColor }} />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <p className={cn("text-sm font-semibold text-[#1A1A1A]", valor === null && "text-[#9CA3AF]")}>
                {status ? `● ${getScoreLabel(score ?? 0)}` : "Sin datos"}
              </p>
              {status ? (
                <p className="text-xs text-[#6B6B6B]">Acción: {action}</p>
              ) : (
                <p className="text-xs text-[#6B6B6B]">Acción: {benchmark?.como_obtenerlo ?? "Ingresar dato manualmente."}</p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
