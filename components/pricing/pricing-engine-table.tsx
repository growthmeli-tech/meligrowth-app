"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import type { MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import {
  calcRealProfit,
  calcSellingPrice,
  coerceReputacion,
  normalizePct,
  type LogisticaType
} from "@/lib/pricing/calculator";
import { savePricingSkuInputs } from "@/app/(ops)/ops/pricing/actions";
import { pushOptimalPriceToML } from "@/app/(ops)/ops/catalog/actions";
import { cn } from "@/lib/utils";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

type Draft = {
  costo: number;
  logistica: LogisticaType;
  publicidad_pct: number;
  margen_pct: number;
};

type Props = {
  rows: PricingSkuRow[];
  mlLinks?: Record<string, MlPublicationLink>;
  mlAccountId: string;
};

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function rowToDraft(r: PricingSkuRow): Draft {
  return {
    costo: Number(r.costo),
    logistica: r.logistica as LogisticaType,
    publicidad_pct:
      r.publicidad_pct === null || r.publicidad_pct === undefined ? 0 : normalizePct(Number(r.publicidad_pct)),
    margen_pct:
      r.margen_pct === null || r.margen_pct === undefined ? 0.15 : normalizePct(Number(r.margen_pct)) || 0.15
  };
}

function pctLabel(v: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function resultadoTone(ganancia: number, margenReal: number): string {
  if (ganancia < 0) return "bg-red-100 text-red-950";
  if (margenReal >= 0.15) return "text-emerald-800";
  if (margenReal >= 0.1) return "text-amber-800";
  return "text-orange-800";
}

export function PricingEngineTable({ rows, mlLinks, mlAccountId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "destroy" | "risk">("all");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const savedSnapshot = useRef<Record<string, Draft>>({});
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ skuId: string; field: keyof Draft } | null>(null);

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const r of rows) {
      next[r.id] = rowToDraft(r);
    }
    setDrafts(next);
    savedSnapshot.current = { ...next };
  }, [rows]);

  const isDirty = useCallback(
    (id: string) => {
      const d = drafts[id];
      const s = savedSnapshot.current[id];
      if (!d || !s) return false;
      return (
        d.costo !== s.costo ||
        d.logistica !== s.logistica ||
        d.publicidad_pct !== s.publicidad_pct ||
        d.margen_pct !== s.margen_pct
      );
    },
    [drafts]
  );

  const weightedMargenObj = useMemo(() => {
    let w = 0;
    let acc = 0;
    for (const r of rows) {
      const d = drafts[r.id];
      if (!d) continue;
      const c = d.costo;
      if (!Number.isFinite(c) || c <= 0) continue;
      w += c;
      acc += d.margen_pct * c;
    }
    if (w <= 0) return null;
    return acc / w;
  }, [rows, drafts]);

  const weightedReal = useMemo(() => {
    let w = 0;
    let acc = 0;
    for (const r of rows) {
      const d = drafts[r.id];
      if (!d) continue;
      const priceMl = mlLinks?.[r.id]?.price_ml;
      if (priceMl === null || priceMl === undefined || !Number.isFinite(priceMl) || priceMl <= 0) continue;
      const rep = coerceReputacion(r.reputacion);
      const rp = calcRealProfit({
        price_ml: priceMl,
        costo: d.costo,
        logistica: d.logistica,
        reputacion: rep,
        publicidad_pct: d.publicidad_pct,
        peso_kg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null
      });
      if (!rp.converged || !Number.isFinite(rp.margen_real)) continue;
      w += d.costo;
      acc += rp.margen_real * d.costo;
    }
    if (w <= 0) return null;
    return acc / w;
  }, [rows, drafts, mlLinks]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const d = drafts[r.id];
      if (!d) return false;
      const priceMl = mlLinks?.[r.id]?.price_ml;
      const rep = coerceReputacion(r.reputacion);
      let margenReal: number | null = null;
      if (priceMl !== null && priceMl !== undefined && Number.isFinite(priceMl) && priceMl > 0) {
        const rp = calcRealProfit({
          price_ml: priceMl,
          costo: d.costo,
          logistica: d.logistica,
          reputacion: rep,
          publicidad_pct: d.publicidad_pct,
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
          : d.margen_pct < 0
            ? "destroy"
            : d.margen_pct < 0.1
              ? "risk"
              : "ok";
      if (riskFilter === "destroy" && tier !== "destroy") return false;
      if (riskFilter === "risk" && tier !== "risk") return false;
      if (!qq) return true;
      const sku = (r.sku ?? "").toLowerCase();
      const prod = (r.producto ?? "").toLowerCase();
      return sku.includes(qq) || prod.includes(qq);
    });
  }, [rows, q, riskFilter, mlLinks, drafts]);

  const saveRow = (r: PricingSkuRow) => {
    const d = drafts[r.id];
    if (!d) return;
    startTransition(() => {
      void (async () => {
        const res = await savePricingSkuInputs(r.id, mlAccountId, {
          costo: d.costo,
          logistica: d.logistica,
          publicidad_pct: d.publicidad_pct,
          margen_pct: d.margen_pct
        });
        if (!res.success) {
          console.error(res.error);
          return;
        }
        savedSnapshot.current[r.id] = { ...d };
        setSavedFlashId(r.id);
        window.setTimeout(() => setSavedFlashId((cur) => (cur === r.id ? null : cur)), 1800);
        router.refresh();
      })();
    });
  };

  const runTransitionAsync = useCallback((fn: () => Promise<void>) => {
    startTransition(() => {
      void fn();
    });
  }, [startTransition]);

  const revertRow = (r: PricingSkuRow) => {
    const snap = savedSnapshot.current[r.id];
    if (!snap) return;
    setDrafts((prev) => ({ ...prev, [r.id]: { ...snap } }));
  };

  const onKeyDownRow = (e: React.KeyboardEvent, r: PricingSkuRow) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isDirty(r.id)) saveRow(r);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      revertRow(r);
      setEditing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            💰
          </span>
          <h1 className="text-lg font-black uppercase tracking-tight text-[#1A1A1A]">Motor de precios</h1>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-3 py-1 font-semibold text-[#1A1A1A]">
            {rows.length} SKUs
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen objetivo prom.: {weightedMargenObj === null ? "—" : pctLabel(weightedMargenObj)}
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen real prom.: {weightedReal === null ? "—" : pctLabel(weightedReal)}
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
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-2" colSpan={1}>
                SKU / Producto
              </th>
              <th className="p-2" colSpan={1}>
                ML
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2 text-center" colSpan={4}>
                ◄ Lo que vos sabés ►
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2 text-center" colSpan={1}>
                ◄ Lo que calcula ►
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2" colSpan={1}>
                Resultado
              </th>
              <th className="p-2" colSpan={1}>
                Acción
              </th>
            </tr>
            <tr className="border-b border-[#E8E8E2] bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-2">SKU</th>
              <th className="p-2">Publicación</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Costo</th>
              <th className="p-2">Log.</th>
              <th className="p-2">Ads</th>
              <th className="p-2">Margen</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Precio óptimo</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Ganancia / margen</th>
              <th className="p-2">ML</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const d = drafts[r.id];
              if (!d) return null;
              const rep = coerceReputacion(r.reputacion);
              const target = calcSellingPrice({
                costo: d.costo,
                logistica: d.logistica,
                publicidad_pct: d.publicidad_pct,
                margen_pct: d.margen_pct,
                reputacion: rep
              });
              const priceMl = mlLinks?.[r.id]?.price_ml;
              const hasMlPrice = priceMl !== null && priceMl !== undefined && Number.isFinite(priceMl) && priceMl > 0;
              const real = hasMlPrice
                ? calcRealProfit({
                    price_ml: priceMl,
                    costo: d.costo,
                    logistica: d.logistica,
                    reputacion: rep,
                    publicidad_pct: d.publicidad_pct,
                    peso_kg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null
                  })
                : null;
              const gananciaReal =
                real && real.converged && Number.isFinite(real.ganancia_real) ? real.ganancia_real : null;
              const margenReal = real && real.converged && Number.isFinite(real.margen_real) ? real.margen_real : null;
              const tier =
                margenReal !== null
                  ? margenReal < 0
                    ? "destroy"
                    : margenReal < 0.1
                      ? "risk"
                      : "ok"
                  : d.margen_pct < 0
                    ? "destroy"
                    : d.margen_pct < 0.1
                      ? "risk"
                      : "ok";
              const ml = mlLinks?.[r.id];
              const dirty = isDirty(r.id);
              const optimal =
                target.converged && Number.isFinite(target.precio_venta) ? Math.round(target.precio_venta) : null;
              const showPush = Boolean(
                hasMlPrice &&
                  optimal !== null &&
                  ml?.item_id &&
                  Math.round(priceMl as number) !== optimal
              );

              return (
                <PricingRow
                  key={r.id}
                  r={r}
                  d={d}
                  setDrafts={setDrafts}
                  editing={editing}
                  setEditing={setEditing}
                  dirty={dirty}
                  tier={tier}
                  ml={ml}
                  hasMlPrice={hasMlPrice}
                  priceMl={priceMl as number | undefined}
                  target={target}
                  gananciaReal={gananciaReal}
                  margenReal={margenReal}
                  optimal={optimal}
                  showPush={showPush}
                  savedFlash={savedFlashId === r.id}
                  isPending={isPending}
                  mlAccountId={mlAccountId}
                  onKeyDownRow={onKeyDownRow}
                  routerRefresh={() => router.refresh()}
                  runTransitionAsync={runTransitionAsync}
                />
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

function PricingRow({
  r,
  d,
  setDrafts,
  editing,
  setEditing,
  dirty,
  tier,
  ml,
  hasMlPrice,
  priceMl,
  target,
  gananciaReal,
  margenReal,
  optimal,
  showPush,
  savedFlash,
  isPending,
  mlAccountId,
  onKeyDownRow,
  routerRefresh,
  runTransitionAsync
}: {
  r: PricingSkuRow;
  d: Draft;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, Draft>>>;
  editing: { skuId: string; field: keyof Draft } | null;
  setEditing: (v: { skuId: string; field: keyof Draft } | null) => void;
  dirty: boolean;
  tier: "destroy" | "risk" | "ok";
  ml?: MlPublicationLink;
  hasMlPrice: boolean;
  priceMl?: number;
  target: ReturnType<typeof calcSellingPrice>;
  gananciaReal: number | null;
  margenReal: number | null;
  optimal: number | null;
  showPush: boolean;
  savedFlash: boolean;
  isPending: boolean;
  mlAccountId: string;
  onKeyDownRow: (e: React.KeyboardEvent, r: PricingSkuRow) => void;
  routerRefresh: () => void;
  runTransitionAsync: (fn: () => Promise<void>) => void;
}) {
  const [pushOpen, setPushOpen] = useState(false);

  const update = (patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ...patch } }));
  };

  const resultadoBlock = (() => {
    if (hasMlPrice && gananciaReal !== null && margenReal !== null && !Number.isNaN(gananciaReal)) {
      const tone = resultadoTone(gananciaReal, margenReal);
      return (
        <div className={cn("space-y-0.5 tabular-nums", tone)}>
          <div className="font-semibold">
            {gananciaReal >= 0 ? "+" : ""}
            {ars.format(gananciaReal)}
          </div>
          <div className="text-xs">{(margenReal * 100).toFixed(1)}% real</div>
        </div>
      );
    }
    if (target.converged && Number.isFinite(target.ganancia_unit) && Number.isFinite(target.precio_venta)) {
      const margObj = d.margen_pct;
      return (
        <div className="space-y-0.5 tabular-nums text-[#6B6B6B]">
          <div className="font-semibold text-[#1A1A1A]">
            {target.ganancia_unit >= 0 ? "+" : ""}
            {ars.format(target.ganancia_unit)}
          </div>
          <div className="text-xs">{(margObj * 100).toFixed(1)}% obj.</div>
          <div className="text-[10px] italic text-[#6B6B6B]">(objetivo)</div>
        </div>
      );
    }
    return <span className="text-[#6B6B6B]">—</span>;
  })();

  return (
    <tr
      tabIndex={0}
      onKeyDown={(e) => onKeyDownRow(e, r)}
      className={cn(
        "border-b border-[#E8E8E2] align-top outline-none",
        dirty && "bg-amber-50/60",
        !dirty && tier === "destroy" && "bg-red-50",
        !dirty && tier === "risk" && "bg-amber-50/90",
        !dirty && tier === "ok" && "bg-white",
        savedFlash && "ring-1 ring-emerald-300"
      )}
    >
      <td className="p-2 font-semibold text-[#1A1A1A]">
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
        <div className="mt-1 max-w-[220px] text-xs font-normal leading-snug">{r.producto}</div>
        {savedFlash ? <p className="mt-1 text-[10px] font-semibold text-emerald-700">✓ Guardado</p> : null}
      </td>
      <td className="p-2 text-xs">
        {ml?.permalink ? (
          <div>
            <Link
              href={ml.permalink}
              className="font-mono font-semibold text-blue-700 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {ml.item_id}
            </Link>
            <div className="mt-1 text-[#6B6B6B]">
              Stock: {ml?.stock === null || ml?.stock === undefined ? "—" : ml.stock}
            </div>
          </div>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">Sin ML</span>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-1">
        {editing?.skuId === r.id && editing.field === "costo" ? (
          <input
            autoFocus
            type="number"
            className="w-full min-w-[88px] rounded border border-[#E8E8E2] px-1 py-1 text-xs tabular-nums"
            value={Number.isFinite(d.costo) ? d.costo : ""}
            onChange={(e) => update({ costo: Number(e.target.value) || 0 })}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-left text-xs tabular-nums hover:bg-neutral-100"
            onClick={() => setEditing({ skuId: r.id, field: "costo" })}
          >
            {Number.isFinite(d.costo) && d.costo > 0 ? ars.format(d.costo) : "—"}
          </button>
        )}
      </td>
      <td className="p-1">
        <select
          className="w-full max-w-[100px] rounded border border-[#E8E8E2] bg-white px-1 py-1 text-xs font-medium"
          value={d.logistica}
          onChange={(e) => update({ logistica: e.target.value as LogisticaType })}
        >
          <option value="Flex">Flex</option>
          <option value="Full">Full</option>
          <option value="Retiro domicilio">Retiro</option>
        </select>
      </td>
      <td className="p-1">
        {editing?.skuId === r.id && editing.field === "publicidad_pct" ? (
          <input
            autoFocus
            type="number"
            step={0.1}
            min={0}
            max={100}
            className="w-full min-w-[56px] rounded border border-[#E8E8E2] px-1 py-1 text-xs"
            value={Math.round(d.publicidad_pct * 1000) / 10}
            onChange={(e) => update({ publicidad_pct: normalizePct(Number(e.target.value)) })}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-left text-xs tabular-nums hover:bg-neutral-100"
            onClick={() => setEditing({ skuId: r.id, field: "publicidad_pct" })}
          >
            {(d.publicidad_pct * 100).toFixed(0)}%
          </button>
        )}
      </td>
      <td className="p-1">
        {editing?.skuId === r.id && editing.field === "margen_pct" ? (
          <input
            autoFocus
            type="number"
            step={0.5}
            min={0}
            max={100}
            className="w-full min-w-[56px] rounded border border-[#E8E8E2] px-1 py-1 text-xs"
            value={Math.round(d.margen_pct * 1000) / 10}
            onChange={(e) => update({ margen_pct: normalizePct(Number(e.target.value)) || 0.01 })}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-left text-xs tabular-nums hover:bg-neutral-100"
            onClick={() => setEditing({ skuId: r.id, field: "margen_pct" })}
          >
            {(d.margen_pct * 100).toFixed(1)}%
          </button>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-2 tabular-nums text-sm font-semibold text-[#1A1A1A]">
        {optimal !== null ? ars.format(optimal) : "—"}
        {target.converged ? null : (
          <div className="text-[10px] font-normal text-amber-800">Sin convergencia</div>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-2 text-sm">{resultadoBlock}</td>
      <td className="p-2 align-top text-xs">
        {showPush && ml?.item_id && optimal !== null && priceMl !== undefined ? (
          <div className="space-y-2">
            {!pushOpen ? (
              <button
                type="button"
                disabled={isPending}
                className="rounded-lg border border-[#1A1A1A] bg-[#FFD600] px-2 py-1 font-semibold text-[#1A1A1A] disabled:opacity-50"
                onClick={() => setPushOpen(true)}
              >
                ↑ ML: {ars.format(priceMl)} → {ars.format(optimal)}
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-[#FAFAF8] p-2">
                <p className="font-semibold text-[#1A1A1A]">¿Actualizar precio en ML?</p>
                <p className="tabular-nums text-[#1A1A1A]">
                  {ars.format(priceMl)} → {ars.format(optimal)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[#1A1A1A] px-2 py-1 font-semibold text-white"
                    disabled={isPending}
                    onClick={() => {
                      runTransitionAsync(async () => {
                        const res = await pushOptimalPriceToML(mlAccountId, ml.item_id, optimal);
                        if (!res.success) {
                          console.error(res.error);
                          return;
                        }
                        setPushOpen(false);
                        routerRefresh();
                      });
                    }}
                  >
                    Confirmar
                  </button>
                  <button type="button" className="rounded-lg border border-[#E8E8E2] px-2 py-1 font-semibold" onClick={() => setPushOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[#6B6B6B]">—</span>
        )}
      </td>
    </tr>
  );
}
