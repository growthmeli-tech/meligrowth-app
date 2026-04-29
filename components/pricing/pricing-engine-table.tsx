"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, Tag } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

type Props = {
  rows: PricingSkuRow[];
  weightedMargenPct: number | null;
};

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function pctLabel(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function rowRiskTier(margenPct: number | null): "destroy" | "risk" | "ok" | "unknown" {
  if (margenPct === null || margenPct === undefined) return "unknown";
  if (margenPct < 0) return "destroy";
  if (margenPct < 0.1) return "risk";
  return "ok";
}

export function PricingEngineTable({ rows, weightedMargenPct }: Props) {
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "destroy" | "risk">("all");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const tier = rowRiskTier(r.margen_pct !== null && r.margen_pct !== undefined ? Number(r.margen_pct) : null);
      if (riskFilter === "destroy" && tier !== "destroy") return false;
      if (riskFilter === "risk" && tier !== "risk") return false;
      if (!qq) return true;
      const sku = (r.sku ?? "").toLowerCase();
      const prod = (r.producto ?? "").toLowerCase();
      return sku.includes(qq) || prod.includes(qq);
    });
  }, [rows, q, riskFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-[#1A1A1A]" />
          <h1 className="text-lg font-black text-[#1A1A1A]">Motor de precios</h1>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen prom.: {weightedMargenPct === null ? "—" : pctLabel(weightedMargenPct)}
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-1 font-semibold text-[#6B6B6B]">
            SKUs: {rows.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
          <input
            type="search"
            placeholder="Buscar SKU o producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-[#E8E8E2] bg-white py-2 pl-10 pr-3 text-sm font-medium text-[#1A1A1A] outline-none ring-brand-purple/20 focus:ring-2"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6B6B6B]">Filtro</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as "all" | "destroy" | "risk")}
            className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A]"
          >
            <option value="all">Todos</option>
            <option value="destroy">Destruye margen</option>
            <option value="risk">Margen en riesgo (&lt;10%)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E8E8E2] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-3">SKU / Producto</th>
              <th className="p-3">Costo</th>
              <th className="p-3">Precio venta</th>
              <th className="p-3">Ganancia</th>
              <th className="p-3">Margen target</th>
              <th className="p-3">ROI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const m = r.margen_pct !== null && r.margen_pct !== undefined ? Number(r.margen_pct) : null;
              const tier = rowRiskTier(m);
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-[#E8E8E2] align-top",
                    tier === "destroy" && "bg-red-50",
                    tier === "risk" && "bg-amber-50/90",
                    tier === "unknown" && "bg-white"
                  )}
                >
                  <td className="p-3 font-semibold text-[#1A1A1A]">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs text-[#6B6B6B]">{r.sku ?? "—"}</span>
                      {tier === "destroy" ? (
                        <span title="Destruye margen" className="inline-flex shrink-0 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      ) : tier === "risk" ? (
                        <span title="Margen en riesgo" className="inline-flex shrink-0 text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 max-w-[280px] text-xs font-normal leading-snug">{r.producto}</div>
                  </td>
                  <td className="p-3 tabular-nums">{ars.format(Number(r.costo))}</td>
                  <td className="p-3 tabular-nums">
                    {r.precio_venta !== null && r.precio_venta !== undefined ? ars.format(Number(r.precio_venta)) : "—"}
                  </td>
                  <td className="p-3 tabular-nums">
                    {r.ganancia_unit !== null && r.ganancia_unit !== undefined ? ars.format(Number(r.ganancia_unit)) : "—"}
                  </td>
                  <td className="p-3 tabular-nums">{pctLabel(m)}</td>
                  <td className="p-3 tabular-nums">
                    {r.roi !== null && r.roi !== undefined ? `${Number(r.roi).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && rows.length > 0 ? (
        <p className="text-sm text-[#6B6B6B]">No hay filas con ese criterio.</p>
      ) : null}
    </div>
  );
}
