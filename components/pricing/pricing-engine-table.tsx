"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Search, Tag } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import type { MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import {
  calcRealProfit,
  calcSellingPrice,
  coerceReputacion,
  normalizePct,
  type LogisticaType
} from "@/lib/pricing/calculator";
import { cn } from "@/lib/utils";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

type Props = {
  rows: PricingSkuRow[];
  weightedMargenPct: number | null;
  mlLinks?: Record<string, MlPublicationLink>;
};

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function pctLabel(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function vsObjetivoTone(margenReal: number | null, margenTarget: number): "green" | "amber" | "red" | "unknown" {
  if (margenReal === null || Number.isNaN(margenReal)) return "unknown";
  if (margenReal >= margenTarget) return "green";
  if (margenReal >= margenTarget - 0.05) return "amber";
  return "red";
}

export function PricingEngineTable({ rows, weightedMargenPct, mlLinks }: Props) {
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "destroy" | "risk">("all");

  const weightedReal = useMemo(() => {
    let w = 0;
    let acc = 0;
    for (const r of rows) {
      const priceMl = mlLinks?.[r.id]?.price_ml;
      if (priceMl === null || priceMl === undefined || !Number.isFinite(priceMl) || priceMl <= 0) continue;
      const pub = normalizePct(r.publicidad_pct ?? 0);
      const margT = normalizePct(r.margen_pct ?? 0.15) || 0.15;
      const rp = calcRealProfit({
        price_ml: priceMl,
        costo: Number(r.costo),
        logistica: r.logistica as LogisticaType,
        reputacion: coerceReputacion(r.reputacion),
        publicidad_pct: pub,
        peso_kg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null
      });
      if (!rp.converged || !Number.isFinite(rp.margen_real)) continue;
      w += Number(r.costo);
      acc += rp.margen_real * Number(r.costo);
    }
    if (w <= 0) return null;
    return acc / w;
  }, [rows, mlLinks]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const priceMl = mlLinks?.[r.id]?.price_ml;
      const pub = normalizePct(r.publicidad_pct ?? 0);
      const margT = normalizePct(r.margen_pct ?? 0.15) || 0.15;
      let margenReal: number | null = null;
      if (priceMl !== null && priceMl !== undefined && Number.isFinite(priceMl) && priceMl > 0) {
        const rp = calcRealProfit({
          price_ml: priceMl,
          costo: Number(r.costo),
          logistica: r.logistica as LogisticaType,
          reputacion: coerceReputacion(r.reputacion),
          publicidad_pct: pub,
          peso_kg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null
        });
        margenReal = rp.converged && Number.isFinite(rp.margen_real) ? rp.margen_real : null;
      }
      const tier =
        margenReal !== null && !Number.isNaN(margenReal)
          ? margenReal < 0
            ? "destroy"
            : margenReal < 0.1
              ? "risk"
              : "ok"
          : margT < 0
            ? "destroy"
            : margT < 0.1
              ? "risk"
              : "ok";
      if (riskFilter === "destroy" && tier !== "destroy") return false;
      if (riskFilter === "risk" && tier !== "risk") return false;
      if (!qq) return true;
      const sku = (r.sku ?? "").toLowerCase();
      const prod = (r.producto ?? "").toLowerCase();
      return sku.includes(qq) || prod.includes(qq);
    });
  }, [rows, q, riskFilter, mlLinks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-[#1A1A1A]" />
          <h1 className="text-lg font-black text-[#1A1A1A]">Motor de precios</h1>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen objetivo prom.: {weightedMargenPct === null ? "—" : pctLabel(weightedMargenPct)}
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen real prom.: {weightedReal === null ? "—" : pctLabel(weightedReal)}
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
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-3">SKU / Producto</th>
              <th className="p-3">Publicación ML</th>
              <th className="p-3">Stock ML</th>
              <th className="p-3">Costo</th>
              <th className="p-3">Precio actual ML</th>
              <th className="p-3">Precio venta obj.</th>
              <th className="p-3">Ganancia real</th>
              <th className="p-3">Ganancia obj.</th>
              <th className="p-3">Margen target</th>
              <th className="p-3">vs Objetivo</th>
              <th className="p-3">ROI obj.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const pub = normalizePct(r.publicidad_pct ?? 0);
              const margT = normalizePct(r.margen_pct ?? 0.15) || 0.15;
              const rep = coerceReputacion(r.reputacion);
              const target = calcSellingPrice({
                costo: Number(r.costo),
                logistica: r.logistica as LogisticaType,
                publicidad_pct: pub,
                margen_pct: margT,
                reputacion: rep
              });
              const priceMl = mlLinks?.[r.id]?.price_ml;
              const hasMlPrice = priceMl !== null && priceMl !== undefined && Number.isFinite(priceMl) && priceMl > 0;
              const real = hasMlPrice
                ? calcRealProfit({
                    price_ml: priceMl,
                    costo: Number(r.costo),
                    logistica: r.logistica as LogisticaType,
                    reputacion: rep,
                    publicidad_pct: pub,
                    peso_kg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null
                  })
                : null;
              const gananciaReal =
                real && real.converged && Number.isFinite(real.ganancia_real) ? real.ganancia_real : null;
              const margenReal = real && real.converged && Number.isFinite(real.margen_real) ? real.margen_real : null;
              const deltaPct =
                margenReal !== null ? Math.round((margenReal - margT) * 10_000) / 100 : null;
              const vsTone = vsObjetivoTone(margenReal, margT);
              const tier =
                margenReal !== null
                  ? margenReal < 0
                    ? "destroy"
                    : margenReal < 0.1
                      ? "risk"
                      : "ok"
                  : margT < 0
                    ? "destroy"
                    : margT < 0.1
                      ? "risk"
                      : "ok";
              const ml = mlLinks?.[r.id];
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-[#E8E8E2] align-top",
                    tier === "destroy" && "bg-red-50",
                    tier === "risk" && "bg-amber-50/90",
                    tier === "ok" && "bg-white"
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
                  <td className="p-3 text-sm">
                    {ml?.permalink ? (
                      <Link href={ml.permalink} className="font-semibold text-blue-700 underline underline-offset-2" target="_blank" rel="noreferrer">
                        {ml.item_id}
                      </Link>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">Sin publicación ML</span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums text-sm">{ml?.stock === null || ml?.stock === undefined ? "—" : ml.stock}</td>
                  <td className="p-3 tabular-nums">{Number.isFinite(Number(r.costo)) ? ars.format(Number(r.costo)) : "—"}</td>
                  <td className="p-3 tabular-nums">{hasMlPrice ? ars.format(priceMl) : "—"}</td>
                  <td className="p-3 tabular-nums">
                    {target.converged && Number.isFinite(target.precio_venta) ? ars.format(target.precio_venta) : "—"}
                  </td>
                  <td className="p-3 tabular-nums font-semibold">
                    {gananciaReal === null ? "—" : ars.format(gananciaReal)}
                  </td>
                  <td className="p-3 tabular-nums">
                    {target.converged && Number.isFinite(target.ganancia_unit) ? ars.format(target.ganancia_unit) : "—"}
                  </td>
                  <td className="p-3 tabular-nums">{pctLabel(margT)}</td>
                  <td
                    className={cn(
                      "p-3 tabular-nums font-semibold",
                      vsTone === "green" && "text-emerald-800",
                      vsTone === "amber" && "text-amber-800",
                      vsTone === "red" && "text-red-700",
                      vsTone === "unknown" && "text-[#6B6B6B]"
                    )}
                  >
                    {deltaPct === null ? "—" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)} pp`}
                  </td>
                  <td className="p-3 tabular-nums">
                    {target.converged && Number.isFinite(target.roi) ? `${target.roi.toFixed(1)}%` : "—"}
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
