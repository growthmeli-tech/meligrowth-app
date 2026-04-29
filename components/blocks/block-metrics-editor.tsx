"use client";

import { Pencil, X } from "lucide-react";
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
type DependencyColumn = keyof MetricSnapshotInsert | "ventas_ads_pct";

/** Synthetic row keys that map to snapshot writes; ventas_ads_pct derives ventas_ads. */
export const FIELD_DEPENDENCIES: Partial<
  Record<DependencyColumn, { requires: keyof MetricSnapshotInsert; errorMessage: string }>
> = {
  ventas_ads_pct: {
    requires: "ventas_totales",
    errorMessage: "Ingresá Ventas Totales primero para calcular este porcentaje"
  }
};

export type BlockMetricRowModel = {
  metrica: string;
  label: string;
  benchmarkKey: string;
  valor: number | null;
  /** Snapshot column written on save; ventas_ads_pct derives ventas_ads */
  column: keyof MetricSnapshotInsert | "ventas_ads_pct";
  /** When set, overrides benchmark unit for display (e.g. raw currency totals). */
  valueUnit?: "pct" | "x" | "dias" | "nivel" | "plain";
};

type BlockMetricsEditorProps = {
  mlAccountId: string;
  block: InternalBlockSlug;
  rows: BlockMetricRowModel[];
  blockSource: "api" | "manual" | null;
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

function formatDisplay(value: number | null, unit: "pct" | "x" | "dias" | "nivel" | "plain") {
  if (value === null || Number.isNaN(value)) return "Sin datos";
  if (unit === "plain") return value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

function meetsVentasTotalesForPct(v: number | null): boolean {
  return v != null && v > 0;
}

export function BlockMetricsEditor({ mlAccountId, block, rows, blockSource }: BlockMetricsEditorProps) {
  const [manualMetrics, setManualMetrics] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [, start] = useTransition();

  const displayVal = (row: BlockMetricRowModel) => (row.metrica in overrides ? overrides[row.metrica] : row.valor);

  const valueForColumn = (col: keyof MetricSnapshotInsert): number | null => {
    const row = rows.find((r) => r.column === col);
    return row ? displayVal(row) : null;
  };

  const effectiveVentasTotales = valueForColumn("ventas_totales");
  const effectiveGastoAds = valueForColumn("gasto_ads");
  const effectiveVentasAds = valueForColumn("ventas_ads");

  const canDeriveAdsPct =
    meetsVentasTotalesForPct(effectiveVentasTotales) && effectiveGastoAds !== null && effectiveVentasAds !== null;

  const derivedVentasAdsPct =
    canDeriveAdsPct && effectiveVentasTotales != null && effectiveVentasAds != null
      ? (effectiveVentasAds / effectiveVentasTotales) * 100
      : null;

  const rowSource = (metrica: string): "api" | "manual" | null => {
    if (manualMetrics.has(metrica)) return "manual";
    return blockSource;
  };

  const clearFieldError = (metrica: string) => {
    setFieldErrors((prev) => {
      if (!(metrica in prev)) return prev;
      const next = { ...prev };
      delete next[metrica];
      return next;
    });
  };

  const beginEdit = (row: BlockMetricRowModel) => {
    const v = displayVal(row);
    setEditingKey(row.metrica);
    setDraft(v === null || Number.isNaN(v) ? "" : String(v));
    clearFieldError(row.metrica);
  };

  const cancelEdit = () => {
    if (editingKey) clearFieldError(editingKey);
    setEditingKey(null);
    setDraft("");
  };

  const saveEdit = (row: BlockMetricRowModel) => {
    start(async () => {
      const parsed = parseNumericInput(draft);
      if (parsed === null && draft.trim() !== "") {
        setFieldErrors((e) => ({ ...e, [row.metrica]: "Valor numérico inválido" }));
        return;
      }

      const dep = FIELD_DEPENDENCIES[row.column as DependencyColumn];
      if (dep) {
        const reqVal = valueForColumn(dep.requires);
        if (!meetsVentasTotalesForPct(reqVal)) {
          setFieldErrors((e) => ({ ...e, [row.metrica]: dep.errorMessage }));
          return;
        }
      }

      let payload: Partial<MetricSnapshotInsert> = {};

      if (row.column === "ventas_ads_pct") {
        if (parsed === null) {
          setFieldErrors((e) => ({ ...e, [row.metrica]: "Ingresá un porcentaje válido." }));
          return;
        }
        const vt = valueForColumn("ventas_totales")!;
        payload = { ventas_ads: (parsed / 100) * vt };
      } else if (parsed === null) {
        payload = { [row.column]: null } as Partial<MetricSnapshotInsert>;
      } else {
        payload = { [row.column]: parsed } as Partial<MetricSnapshotInsert>;
      }

      const res = await updateBlockMetrics(mlAccountId, block, payload);
      if (!res.success) {
        setFieldErrors((e) => ({ ...e, [row.metrica]: res.error ?? "No se pudo guardar" }));
        return;
      }

      setOverrides((o) => ({ ...o, [row.metrica]: parsed }));
      setManualMetrics((m) => new Set(m).add(row.metrica));
      clearFieldError(row.metrica);
      setEditingKey(null);
      setDraft("");
    });
  };

  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Métricas detalladas</p>
      {rows.map((row) => {
        const isDerivedPctReadOnly = row.column === "ventas_ads_pct" && canDeriveAdsPct;
        const valor =
          row.column === "ventas_ads_pct" && isDerivedPctReadOnly && derivedVentasAdsPct !== null
            ? derivedVentasAdsPct
            : displayVal(row);

        const [category, metricName] = parseBenchmarkKey(row.benchmarkKey);
        const benchmark = category ? getBenchmarkDefinition(category, metricName || row.metrica) : null;
        const score = typeof valor === "number" ? calcScore(row.metrica, valor) : null;
        const status = typeof score === "number" ? getStatusFromScore(score) : null;
        const action = status ? ACCIONES_POR_METRICA[row.metrica]?.[status] ?? "Revisar esta métrica con el equipo operativo." : null;
        const scoreStatusKey = typeof score === "number" ? getScoreStatus(score) : null;
        const progressColor = scoreStatusKey ? DESIGN_TOKENS.score[scoreStatusKey].color : "#E8E8E2";
        const unit = row.valueUnit ?? benchmark?.unidad ?? "pct";
        const src = rowSource(row.metrica);
        const rowError = fieldErrors[row.metrica];
        const showScoreSection = benchmark !== null;

        return (
          <article key={row.metrica} className="rounded-xl border border-[#E8E8E2] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">{row.label}</p>
                <p className="mt-1 text-xs text-[#6B6B6B]">{benchmark ? formatBenchmarkLine(benchmark.levels) : "Sin benchmark definido"}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {editingKey === row.metrica ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <input
                        className="w-36 rounded-lg border border-[#E8E8E2] px-2 py-1 font-mono text-sm"
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          clearFieldError(row.metrica);
                        }}
                        aria-label={`Editar ${row.label}`}
                        aria-invalid={Boolean(rowError)}
                      />
                      <button type="button" className="rounded-lg bg-[#FFD600] px-3 py-1 text-xs font-semibold text-[#1A1A1A]" onClick={() => saveEdit(row)}>
                        Guardar
                      </button>
                      <button type="button" className="text-xs font-semibold text-zinc-600 hover:text-[#1A1A1A]" onClick={cancelEdit}>
                        Cancelar
                      </button>
                    </div>
                    {rowError ? (
                      <div className="flex max-w-[min(100%,20rem)] items-start gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800" role="alert">
                        <span className="flex-1">{rowError}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-red-700 hover:bg-red-100"
                          aria-label="Descartar mensaje"
                          onClick={() => clearFieldError(row.metrica)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-[#1A1A1A]">{formatDisplay(valor, unit)}</p>
                    {isDerivedPctReadOnly ? null : (
                      <button
                        type="button"
                        className="rounded p-1 text-zinc-500 hover:bg-[#F5F5F0] hover:text-[#1A1A1A]"
                        aria-label={`Editar ${row.label}`}
                        onClick={() => beginEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
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

            {showScoreSection ? (
              <>
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
              </>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-[#6B6B6B]">Métrica base — sin escala en esta vista.</p>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
