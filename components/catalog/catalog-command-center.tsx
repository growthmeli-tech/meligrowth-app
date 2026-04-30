"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Filter, RefreshCw } from "lucide-react";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { cn } from "@/lib/utils";
import {
  bulkMarkNoAds,
  exportMasterCatalog,
  linkSkuToItem,
  pushOptimalPriceToML,
  saveCostForItem,
  triggerCatalogSync
} from "@/app/(ops)/ops/catalog/actions";
import {
  calcRealProfit,
  calcSellingPrice,
  calcStockStatus,
  coerceReputacion,
  mlComisionRate,
  normalizePct,
  type LogisticaType,
  type ReputacionType
} from "@/lib/pricing/calculator";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

type PricingChoice = { id: string; sku: string | null; producto: string };

type Props = {
  mlAccountId: string;
  initialItems: UnifiedCatalogItem[];
  lastSyncedAt: string | null;
  pricingSkuChoices: PricingChoice[];
  loadError: string | null;
};

function downloadBase64(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSyncLabel(iso: string | null) {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return d.toLocaleString("es-AR");
}

/** Max 2 insights, solo accionables */
function buildInsights(items: UnifiedCatalogItem[]): string[] {
  const out: string[] = [];
  const destroyers = items.filter(
    (i) => i.tiene_costo && i.margen_real_pct !== null && i.margen_real_pct < 0 && i.price_ml !== null
  );
  if (destroyers.length) {
    const x = destroyers[0];
    const m = x.margen_real_pct !== null ? (x.margen_real_pct * 100).toFixed(0) : "?";
    out.push(
      `${x.item_id}: margen real ${m}% — ajustá precio o costo antes de seguir vendiendo.`
    );
  }
  const sinCosto = items.filter((i) => !i.tiene_costo).length;
  if (sinCosto > 0 && out.length < 2) {
    out.push(`${sinCosto} publicación${sinCosto > 1 ? "es" : ""} sin costo — cargá costo para ver ganancia real.`);
  }
  return out.slice(0, 2);
}

type PillKey = "critico" | "reponer" | "riesgo" | "ok";

function isCriticoRow(row: UnifiedCatalogItem): boolean {
  return row.stock_status === "critico" || (row.status === "active" && row.stock === 0);
}

function resolveRowAction(row: UnifiedCatalogItem):
  | { kind: "calc"; reason: "pierde" | "optimizar" | "subir" }
  | { kind: "sin_stock" }
  | { kind: "config_cost" }
  | { kind: "none" } {
  if (row.tiene_costo && row.margen_real_pct !== null && row.margen_real_pct < 0) {
    return { kind: "calc", reason: "pierde" };
  }
  if (row.status === "active" && row.stock === 0) {
    return { kind: "sin_stock" };
  }
  if (!row.tiene_costo) {
    return { kind: "config_cost" };
  }
  if (
    row.tiene_costo &&
    row.margen_real_pct !== null &&
    row.margen_real_pct >= 0 &&
    row.margen_real_pct < 0.1 &&
    row.price_ml !== null
  ) {
    return { kind: "calc", reason: "optimizar" };
  }
  if (row.precio_vs_objetivo === "bajo") {
    return { kind: "calc", reason: "subir" };
  }
  return { kind: "none" };
}

function margenObjDefaultForSimulator(row: UnifiedCatalogItem): number {
  if (row.margen_pct !== null && row.margen_pct !== undefined) {
    return normalizePct(row.margen_pct) || 0.15;
  }
  return 0.15;
}

export function CatalogCommandCenter({
  mlAccountId,
  initialItems,
  lastSyncedAt,
  pricingSkuChoices,
  loadError
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = initialItems;
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [logFilter, setLogFilter] = useState<string>("all");
  const [margenFilter, setMargenFilter] = useState<string>("all");
  const [costFilter, setCostFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [activePill, setActivePill] = useState<PillKey | null>(null);
  const [advOpen, setAdvOpen] = useState(false);

  const [costForms, setCostForms] = useState<Record<string, { costo: string; logistica: string; margen: string; pub: string }>>({});
  const [inlineCostItemId, setInlineCostItemId] = useState<string | null>(null);
  const [inlineCalcItemId, setInlineCalcItemId] = useState<string | null>(null);

  const stale = useMemo(() => {
    if (!lastSyncedAt) return true;
    return Date.now() - new Date(lastSyncedAt).getTime() > 6 * 60 * 60 * 1000;
  }, [lastSyncedAt]);

  const promMargenReal = useMemo(() => {
    let w = 0;
    let acc = 0;
    for (const row of items) {
      if (!row.tiene_costo || row.margen_real_pct === null || row.costo === null || row.costo <= 0) continue;
      w += row.costo;
      acc += row.margen_real_pct * row.costo;
    }
    if (w <= 0) return null;
    return acc / w;
  }, [items]);

  const insights = useMemo(() => buildInsights(items), [items]);

  const togglePill = (key: PillKey) => {
    setActivePill((prev) => (prev === key ? null : key));
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((row) => {
      if (activePill === "critico") {
        if (!isCriticoRow(row)) return false;
      } else if (activePill === "reponer") {
        if (row.stock_status !== "reponer") return false;
      } else if (activePill === "riesgo") {
        if (
          !(
            row.tiene_costo &&
            row.margen_real_pct !== null &&
            row.margen_real_pct >= 0 &&
            row.margen_real_pct < 0.1 &&
            row.price_ml !== null
          )
        ) {
          return false;
        }
      } else if (activePill === "ok") {
        if (
          !row.tiene_costo ||
          isCriticoRow(row) ||
          (row.margen_real_pct !== null && row.margen_real_pct < 0) ||
          (row.margen_real_pct !== null && row.margen_real_pct >= 0 && row.margen_real_pct < 0.1)
        ) {
          return false;
        }
      }

      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (logFilter !== "all" && (row.logistic_type ?? "") !== logFilter) return false;
      if (costFilter === "sin" && row.tiene_costo) return false;
      if (costFilter === "con" && !row.tiene_costo) return false;

      if (stockFilter !== "all" && (row.stock_status ?? "") !== stockFilter) return false;

      if (margenFilter === "pierde" && !(row.margen_real_pct !== null && row.margen_real_pct < 0)) return false;
      if (margenFilter === "riesgo" && !(row.margen_real_pct !== null && row.margen_real_pct >= 0 && row.margen_real_pct < 0.1)) return false;
      if (margenFilter === "ok") {
        const m = row.margen_real_pct;
        if (m !== null && m < 0) return false;
        if (m !== null && m >= 0 && m < 0.1) return false;
      }

      if (qq) {
        const blob = `${row.item_id} ${row.title} ${row.seller_custom_field ?? ""} ${row.sku ?? ""}`.toLowerCase();
        if (!blob.includes(qq)) return false;
      }
      return true;
    });
  }, [items, q, statusFilter, logFilter, margenFilter, costFilter, stockFilter, activePill]);

  const counts = useMemo(() => {
    const critico = items.filter((i) => isCriticoRow(i)).length;
    const reponer = items.filter((i) => i.stock_status === "reponer").length;
    const margenRiesgo = items.filter(
      (i) => i.tiene_costo && i.margen_real_pct !== null && i.margen_real_pct >= 0 && i.margen_real_pct < 0.1 && i.price_ml !== null
    ).length;
    const ok = items.filter((i) => {
      if (!i.tiene_costo) return false;
      if (isCriticoRow(i)) return false;
      const m = i.margen_real_pct;
      if (m !== null && m < 0) return false;
      if (m !== null && m >= 0 && m < 0.1) return false;
      return true;
    }).length;
    return { critico, reponer, margenRiesgo, ok };
  }, [items]);

  const toggleSelect = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((r) => r.item_id)));
  };

  const onSync = () => {
    setSyncHint(null);
    startTransition(async () => {
      const res = await triggerCatalogSync(mlAccountId);
      if (!res.success) {
        setSyncHint(res.error ?? "No se pudo sincronizar");
        return;
      }
      router.refresh();
    });
  };

  const onExport = (ids?: string[]) => {
    startTransition(async () => {
      const res = await exportMasterCatalog(mlAccountId, ids);
      if (!res.success) {
        setSyncHint(res.error ?? "Export fallido");
        return;
      }
      if (!res.data) {
        setSyncHint("Export fallido");
        return;
      }
      downloadBase64(res.data.base64, res.data.filename);
    });
  };

  const onBulkExport = () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      setSyncHint("Seleccioná filas para exportar.");
      return;
    }
    onExport(ids);
  };

  const onBulkAds = () => {
    const ids = filtered.filter((r) => r.pricing_sku_id && selected.has(r.item_id)).map((r) => r.pricing_sku_id as string);
    if (!ids.length) {
      setSyncHint("Seleccioná filas con costo configurado.");
      return;
    }
    startTransition(async () => {
      const res = await bulkMarkNoAds(mlAccountId, ids);
      if (!res.success) {
        setSyncHint(res.error ?? "No se pudo actualizar");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4" id="mg-catalog-command-table">
      <header className="sticky top-0 z-30 space-y-3 rounded-xl border border-[#E8E8E2] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-black text-[#1A1A1A]">CATÁLOGO MELIGROWTH</h1>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              {items.length} publicaciones · Margen real: {promMargenReal === null ? "—" : `${(promMargenReal * 100).toFixed(1)}%`} · Sync:{" "}
              {formatSyncLabel(lastSyncedAt)}
              {stale ? <span className="ml-2 font-semibold text-amber-800">· Datos desactualizados</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onSync}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-3 py-2 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
              Sincronizar
            </button>
            <button
              type="button"
              disabled={pending || items.length === 0}
              onClick={() => onExport()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFD600] px-3 py-2 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Exportar planilla
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Buscar SKU o título…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setAdvOpen(!advOpen)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm font-semibold text-[#1A1A1A] sm:w-auto"
            >
              <Filter className="h-4 w-4" />
              Filtros
              <ChevronDown className={cn("h-4 w-4 transition", advOpen && "rotate-180")} />
            </button>
            {advOpen ? (
              <div className="absolute right-0 z-40 mt-1 w-full min-w-[280px] rounded-lg border border-[#E8E8E2] bg-white p-3 shadow-lg sm:w-max">
                <div className="grid gap-2 text-sm">
                  <label className="flex flex-col gap-1 font-semibold text-[#6B6B6B]">
                    Estado
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-[#E8E8E2] px-2 py-2 font-normal text-[#1A1A1A]"
                    >
                      <option value="all">Todos</option>
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="closed">closed</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#6B6B6B]">
                    Stock ML
                    <select
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value)}
                      className="rounded-lg border border-[#E8E8E2] px-2 py-2 font-normal text-[#1A1A1A]"
                    >
                      <option value="all">Todos</option>
                      <option value="critico">Crítico</option>
                      <option value="reponer">Reponer</option>
                      <option value="saludable">Saludable</option>
                      <option value="exceso">Exceso</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#6B6B6B]">
                    Logística ML
                    <select
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                      className="rounded-lg border border-[#E8E8E2] px-2 py-2 font-normal text-[#1A1A1A]"
                    >
                      <option value="all">Todas</option>
                      <option value="fulfillment">fulfillment</option>
                      <option value="xd_drop_off">xd_drop_off</option>
                      <option value="cross_docking">cross_docking</option>
                      <option value="self_service">self_service</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#6B6B6B]">
                    Margen real
                    <select
                      value={margenFilter}
                      onChange={(e) => setMargenFilter(e.target.value)}
                      className="rounded-lg border border-[#E8E8E2] px-2 py-2 font-normal text-[#1A1A1A]"
                    >
                      <option value="all">Todos</option>
                      <option value="pierde">Pierde dinero</option>
                      <option value="riesgo">&lt;10%</option>
                      <option value="ok">≥10%</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#6B6B6B]">
                    Costo
                    <select
                      value={costFilter}
                      onChange={(e) => setCostFilter(e.target.value)}
                      className="rounded-lg border border-[#E8E8E2] px-2 py-2 font-normal text-[#1A1A1A]"
                    >
                      <option value="all">Todos</option>
                      <option value="sin">Sin costo</option>
                      <option value="con">Con costo</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => togglePill("critico")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5",
              activePill === "critico" ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-900"
            )}
          >
            <span aria-hidden>🔴</span>
            {counts.critico} crítico
          </button>
          <button
            type="button"
            onClick={() => togglePill("reponer")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5",
              activePill === "reponer" ? "border-amber-500 bg-amber-500 text-[#1A1A1A]" : "border-amber-200 bg-amber-50 text-amber-950"
            )}
          >
            <span aria-hidden>🟡</span>
            {counts.reponer} reponer
          </button>
          <button
            type="button"
            onClick={() => togglePill("riesgo")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5",
              activePill === "riesgo" ? "border-orange-500 bg-orange-500 text-white" : "border-orange-200 bg-orange-50 text-orange-950"
            )}
          >
            <span aria-hidden>🟠</span>
            {counts.margenRiesgo} riesgo
          </button>
          <button
            type="button"
            onClick={() => togglePill("ok")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5",
              activePill === "ok" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900"
            )}
          >
            <span aria-hidden>✅</span>
            {counts.ok} ok
          </button>
        </div>

        {insights.length > 0 ? (
          <div className="space-y-1 border-l-4 border-amber-400 bg-amber-50/80 px-3 py-2 text-xs text-[#1A1A1A]">
            {insights.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        ) : null}

        {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
        {syncHint ? <p className="text-sm text-red-700">{syncHint}</p> : null}
      </header>

      {selected.size > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#E8E8E2] bg-white p-3 text-sm">
          <span className="font-semibold text-[#1A1A1A]">{selected.size} seleccionadas</span>
          <button type="button" disabled={pending} onClick={onBulkExport} className="rounded-lg bg-[#FFD600] px-3 py-1 font-semibold">
            Exportar selección
          </button>
          <button type="button" disabled={pending} onClick={onBulkAds} className="rounded-lg border border-[#E8E8E2] px-3 py-1 font-semibold">
            Marcar sin publicidad (0%)
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[#E8E8E2] bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="w-8 p-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAllFiltered}
                />
              </th>
              <th className="p-2">IMG</th>
              <th className="p-2">Producto + MLA</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Precio ML</th>
              <th className="p-2">Costo</th>
              <th className="p-2">Ganancia</th>
              <th className="p-2">Acción</th>
              <th className="w-8 p-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center">
                  <p className="font-medium text-[#1A1A1A]">No hay publicaciones sincronizadas.</p>
                  <button type="button" disabled={pending} onClick={onSync} className="mt-4 rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold">
                    Sincronizar con Mercado Libre
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <CatalogRows
                  key={row.item_id}
                  row={row}
                  expanded={expanded === row.item_id}
                  onToggleExpand={() => setExpanded(expanded === row.item_id ? null : row.item_id)}
                  pending={pending}
                  selected={selected.has(row.item_id)}
                  onToggleSelect={() => toggleSelect(row.item_id)}
                  mlAccountId={mlAccountId}
                  pricingSkuChoices={pricingSkuChoices}
                  costForms={costForms}
                  setCostForms={setCostForms}
                  onSaved={() => router.refresh()}
                  startTransition={startTransition}
                  inlineCostOpen={inlineCostItemId === row.item_id}
                  setInlineCostOpen={(v) => setInlineCostItemId(v ? row.item_id : null)}
                  inlineCalcOpen={inlineCalcItemId === row.item_id}
                  setInlineCalcOpen={(v) => setInlineCalcItemId(v ? row.item_id : null)}
                  rowAction={resolveRowAction(row)}
                  margenObjSimulatorDefault={margenObjDefaultForSimulator(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogRows({
  row,
  expanded,
  onToggleExpand,
  pending,
  selected,
  onToggleSelect,
  mlAccountId,
  pricingSkuChoices,
  costForms,
  setCostForms,
  onSaved,
  startTransition,
  inlineCostOpen,
  setInlineCostOpen,
  inlineCalcOpen,
  setInlineCalcOpen,
  rowAction,
  margenObjSimulatorDefault
}: {
  row: UnifiedCatalogItem;
  expanded: boolean;
  onToggleExpand: () => void;
  pending: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  mlAccountId: string;
  pricingSkuChoices: PricingChoice[];
  costForms: Record<string, { costo: string; logistica: string; margen: string; pub: string }>;
  setCostForms: Dispatch<SetStateAction<Record<string, { costo: string; logistica: string; margen: string; pub: string }>>>;
  onSaved: () => void;
  startTransition: (cb: () => Promise<void>) => void;
  inlineCostOpen: boolean;
  setInlineCostOpen: (open: boolean) => void;
  inlineCalcOpen: boolean;
  setInlineCalcOpen: (open: boolean) => void;
  rowAction: ReturnType<typeof resolveRowAction>;
  margenObjSimulatorDefault: number;
}) {
  const logisticaRow = (row.logistica ?? "Flex") as LogisticaType;
  const rep = coerceReputacion(row.reputacion);
  const pubN = normalizePct(row.publicidad_pct ?? 0);

  const liveReal =
    row.tiene_costo && row.price_ml !== null && row.costo !== null && row.costo > 0
      ? calcRealProfit({
          price_ml: row.price_ml,
          costo: row.costo,
          logistica: logisticaRow,
          reputacion: rep,
          publicidad_pct: pubN,
          peso_kg: row.peso_kg
        })
      : null;

  const gananciaRealLabel =
    !row.tiene_costo || row.costo === null
      ? "—"
      : liveReal && liveReal.converged && Number.isFinite(liveReal.ganancia_real)
        ? ars.format(liveReal.ganancia_real)
        : "—";

  const margenRealLabel =
    !row.tiene_costo || row.margen_real_pct === null ? "—" : `${(row.margen_real_pct * 100).toFixed(1)}% real`;

  const pierde = row.margen_real_pct !== null && row.margen_real_pct < 0;
  const riesgoMargen = row.tiene_costo && row.margen_real_pct !== null && row.margen_real_pct >= 0 && row.margen_real_pct < 0.1;

  const stockEsCriticoVisual = isCriticoRow(row);

  const rowBg = !row.tiene_costo ? "bg-neutral-50/80" : pierde ? "bg-red-50" : "";

  const borderLeft = stockEsCriticoVisual
    ? "border-l-4 border-l-red-500"
    : riesgoMargen && !pierde
      ? "border-l-4 border-l-amber-400"
      : "border-l-4 border-l-transparent";

  const precioCellClass = row.precio_vs_objetivo === "bajo" ? "bg-orange-50 font-semibold text-orange-950" : "";

  const [linkId, setLinkId] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [mlPushOpen, setMlPushOpen] = useState(false);

  const stockIntel =
    row.stock !== null && row.ventas_30d !== null && row.ventas_30d !== undefined
      ? calcStockStatus({
          stock_actual: row.stock,
          ventas_30d: row.ventas_30d,
          safety_pct: 0.2
        })
      : null;
  const dailySales =
    row.stock !== null && row.ventas_30d !== null && row.ventas_30d > 0 ? row.ventas_30d / 30 : null;
  const daysStock =
    dailySales !== null && dailySales > 0 && row.stock !== null
      ? Math.round((row.stock / dailySales) * 100) / 100
      : null;

  const canPushMlPrice =
    row.status === "active" &&
    row.tiene_costo &&
    row.precio_calculado !== null &&
    row.price_ml !== null &&
    Number.isFinite(row.precio_calculado) &&
    Number.isFinite(row.price_ml) &&
    Math.round(row.precio_calculado) !== Math.round(row.price_ml);

  const comisionPctLabel = `${(mlComisionRate(rep) * 100).toFixed(2)}%`;
  const envioLabel = row.logistic_type ?? row.logistica ?? "—";

  const openCalculator = () => {
    setInlineCalcOpen(true);
    setInlineCostOpen(false);
  };

  const stockBadgeClass =
    row.status === "active" && row.stock === 0
      ? "rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
      : row.stock_status === "critico"
        ? "rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
        : row.stock_status === "reponer"
          ? "rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white"
          : "";

  return (
    <>
      <tr className={cn("border-b border-[#E8E8E2] align-top", rowBg, borderLeft)}>
        <td className="p-2">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Seleccionar ${row.item_id}`} />
        </td>
        <td className="p-2">
          {row.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- ML CDN thumbnails
            <img src={row.thumbnail} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <span className="text-xs text-[#6B6B6B]">—</span>
          )}
        </td>
        <td className="p-2">
          <div className="font-semibold leading-snug text-[#1A1A1A]">{row.title}</div>
          <div className="mt-1 font-mono text-xs text-[#6B6B6B]">{row.item_id}</div>
          {row.sku ? <div className="text-xs text-[#6B6B6B]">SKU costos: {row.sku}</div> : null}
          {!row.tiene_costo ? (
            <span className="mt-2 inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800">
              Sin costo
            </span>
          ) : null}
        </td>
        <td className="p-2">
          <span className={cn(stockBadgeClass)}>{row.stock === null ? "—" : row.stock}</span>
        </td>
        <td className={cn("p-2 tabular-nums", precioCellClass)}>{row.price_ml === null ? "—" : ars.format(row.price_ml)}</td>
        <td className="p-2 tabular-nums">{row.costo === null ? "—" : ars.format(row.costo)}</td>
        <td className="p-2 tabular-nums">
          <div className="font-medium">{gananciaRealLabel}</div>
          <div className="text-xs text-[#6B6B6B]">{margenRealLabel}</div>
        </td>
        <td className="p-2 text-xs">
          <div className="flex flex-col gap-2">
            {rowAction.kind === "config_cost" ? (
              <button
                type="button"
                className="font-semibold text-[#1A1A1A] underline decoration-[#1A1A1A] underline-offset-2"
                onClick={() => {
                  setInlineCostOpen(!inlineCostOpen);
                  setInlineCalcOpen(false);
                }}
              >
                Configurar →
              </button>
            ) : rowAction.kind === "sin_stock" ? (
              <span className="font-semibold text-amber-900">⚠ Sin stock</span>
            ) : rowAction.kind === "calc" ? (
              <button
                type="button"
                className={cn(
                  "font-semibold underline underline-offset-2",
                  rowAction.reason === "pierde" ? "text-red-800 decoration-red-800" : "text-[#1A1A1A] decoration-[#1A1A1A]"
                )}
                onClick={openCalculator}
              >
                {rowAction.reason === "pierde"
                  ? "🔴 Pierde dinero"
                  : rowAction.reason === "optimizar"
                    ? "📈 Optimizar precio"
                    : "↑ Subir precio"}
              </button>
            ) : (
              <span className="text-[#6B6B6B]"> </span>
            )}

            {canPushMlPrice && row.precio_calculado !== null && row.price_ml !== null ? (
              <div className="border-t border-[#E8E8E2] pt-2">
                {!mlPushOpen ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg border border-[#1A1A1A] bg-[#FFD600] px-2 py-1 font-semibold text-[#1A1A1A] disabled:opacity-50"
                    onClick={() => setMlPushOpen(true)}
                  >
                    ↑ ML: {ars.format(row.price_ml)} → {ars.format(row.precio_calculado)}
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-[#FAFAF8] p-2">
                    <p className="font-semibold text-[#1A1A1A]">¿Actualizar precio en ML?</p>
                    <p className="tabular-nums">
                      {ars.format(row.price_ml)} → {ars.format(row.precio_calculado)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-lg bg-[#1A1A1A] px-2 py-1 font-semibold text-white disabled:opacity-50"
                        onClick={() => {
                          startTransition(async () => {
                            const res = await pushOptimalPriceToML(mlAccountId, row.item_id, row.precio_calculado!);
                            if (!res.success) {
                              setHint(res.error ?? "Error al publicar precio");
                              return;
                            }
                            setMlPushOpen(false);
                            setHint(null);
                            onSaved();
                          });
                        }}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[#E8E8E2] px-2 py-1 font-semibold"
                        onClick={() => setMlPushOpen(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </td>
        <td className="p-2">
          <button type="button" onClick={onToggleExpand} className="grid place-items-center rounded border border-[#E8E8E2] p-1" aria-expanded={expanded}>
            <span className="sr-only">Detalle</span>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>

      {inlineCostOpen && !row.tiene_costo ? (
        <tr className="border-b border-[#E8E8E2] bg-neutral-50">
          <td colSpan={9} className="p-4">
            <p className="text-sm font-semibold text-[#1A1A1A]">Configurar costo</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-[#6B6B6B]">
                Costo $
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                  value={costForms[row.item_id]?.costo ?? ""}
                  onChange={(e) =>
                    setCostForms((prev) => ({
                      ...prev,
                      [row.item_id]: {
                        costo: e.target.value,
                        logistica: prev[row.item_id]?.logistica ?? "Flex",
                        margen: prev[row.item_id]?.margen ?? "",
                        pub: prev[row.item_id]?.pub ?? "0"
                      }
                    }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-[#6B6B6B]">
                Logística
                <select
                  className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                  value={costForms[row.item_id]?.logistica ?? "Flex"}
                  onChange={(e) =>
                    setCostForms((prev) => ({
                      ...prev,
                      [row.item_id]: {
                        costo: prev[row.item_id]?.costo ?? "",
                        logistica: e.target.value,
                        margen: prev[row.item_id]?.margen ?? "",
                        pub: prev[row.item_id]?.pub ?? "0"
                      }
                    }))
                  }
                >
                  <option value="Flex">Flex</option>
                  <option value="Full">Full</option>
                  <option value="Retiro domicilio">Retiro domicilio</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#6B6B6B]">
                % Publicidad (0–100 o 0–1)
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                  value={costForms[row.item_id]?.pub ?? "0"}
                  onChange={(e) =>
                    setCostForms((prev) => ({
                      ...prev,
                      [row.item_id]: {
                        costo: prev[row.item_id]?.costo ?? "",
                        logistica: prev[row.item_id]?.logistica ?? "Flex",
                        margen: prev[row.item_id]?.margen ?? "",
                        pub: e.target.value
                      }
                    }))
                  }
                />
              </label>
              <label className="text-xs font-semibold text-[#6B6B6B]">
                % Margen objetivo (requerido)
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                  value={costForms[row.item_id]?.margen ?? ""}
                  placeholder="Ej. 15"
                  onChange={(e) =>
                    setCostForms((prev) => ({
                      ...prev,
                      [row.item_id]: {
                        costo: prev[row.item_id]?.costo ?? "",
                        logistica: prev[row.item_id]?.logistica ?? "Flex",
                        margen: e.target.value,
                        pub: prev[row.item_id]?.pub ?? "0"
                      }
                    }))
                  }
                />
              </label>
            </div>
            {hint ? <p className="mt-2 text-xs text-red-700">{hint}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-lg bg-[#FFD600] px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  const f = costForms[row.item_id];
                  const costo = Number(f?.costo);
                  if (!Number.isFinite(costo) || costo <= 0) {
                    setHint("Ingresá un costo válido.");
                    return;
                  }
                  const margenStr = f?.margen?.trim() ?? "";
                  if (margenStr === "") {
                    setHint("Ingresá un margen objetivo para calcular el precio.");
                    return;
                  }
                  const margen_pct = normalizePct(Number(margenStr));
                  if (!Number.isFinite(margen_pct) || margen_pct <= 0) {
                    setHint("Ingresá un margen objetivo para calcular el precio.");
                    return;
                  }
                  const publicidad_pct = normalizePct(Number(f?.pub ?? 0));
                  const logisticaIns = (f?.logistica ?? "Flex") as "Full" | "Flex" | "Retiro domicilio";
                  setHint(null);
                  startTransition(async () => {
                    const res = await saveCostForItem(mlAccountId, row.item_id, {
                      costo,
                      logistica: logisticaIns,
                      margen_pct,
                      publicidad_pct
                    });
                    if (!res.success) {
                      setHint(res.error ?? "No se pudo guardar");
                      return;
                    }
                    setInlineCostOpen(false);
                    onSaved();
                  });
                }}
              >
                Guardar
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm font-semibold"
                onClick={() => setInlineCostOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      ) : null}

      {inlineCalcOpen && row.tiene_costo ? (
        <tr className="border-b border-[#E8E8E2] bg-[#FAFAF8]">
          <td colSpan={9} className="p-4">
            <InlinePriceCalculator
              row={row}
              mlAccountId={mlAccountId}
              pending={pending}
              margenObjDefault={margenObjSimulatorDefault}
              onClose={() => setInlineCalcOpen(false)}
              onSaved={onSaved}
              startTransition={startTransition}
              setHint={setHint}
            />
            {hint ? <p className="mt-2 text-xs text-red-700">{hint}</p> : null}
          </td>
        </tr>
      ) : null}

      {expanded ? (
        <tr className={cn("border-b border-[#E8E8E2] bg-[#FAFAF8]", rowBg)}>
          <td colSpan={9} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-white p-3 text-sm">
                <p className="font-bold text-[#1A1A1A]">Desglose</p>
                {row.price_ml !== null && row.tiene_costo && liveReal && liveReal.converged ? (
                  <ul className="space-y-1 font-mono text-xs leading-relaxed">
                    <li className="flex justify-between gap-4">
                      <span>Precio ML actual:</span>
                      <span>{ars.format(row.price_ml)}</span>
                    </li>
                    <li className="flex justify-between gap-4 text-[#6B6B6B]">
                      <span>− Comisión ML {comisionPctLabel}:</span>
                      <span>− {ars.format(liveReal.comision_$)}</span>
                    </li>
                    <li className="flex justify-between gap-4 text-[#6B6B6B]">
                      <span>− Envío ({envioLabel}):</span>
                      <span>− {ars.format(liveReal.envio_$)}</span>
                    </li>
                    <li className="flex justify-between gap-4 text-[#6B6B6B]">
                      <span>− Publicidad ({(pubN * 100).toFixed(0)}%):</span>
                      <span>− {ars.format(liveReal.publicidad_$)}</span>
                    </li>
                    <li className="flex justify-between gap-4 text-[#6B6B6B]">
                      <span>− Costo producto:</span>
                      <span>− {ars.format(liveReal.costo_total)}</span>
                    </li>
                    <li className="flex justify-between gap-4 border-t border-[#E8E8E2] pt-1 font-semibold text-[#1A1A1A]">
                      <span>Ganancia real:</span>
                      <span>
                        {liveReal.ganancia_real >= 0 ? "+" : ""}
                        {ars.format(liveReal.ganancia_real)} ({(liveReal.margen_real * 100).toFixed(1)}%)
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-xs text-[#6B6B6B]">{!row.tiene_costo ? "Sin costo — no hay desglose." : "Sin precio ML o datos incompletos."}</p>
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-white p-3 text-sm">
                <p className="font-bold text-[#1A1A1A]">Stock</p>
                <p>Stock actual: {row.stock === null ? "—" : `${row.stock} unidad${row.stock === 1 ? "" : "es"}`}</p>
                {row.ventas_30d !== null && row.ventas_30d !== undefined ? (
                  <>
                    <p>Ventas 30d: {row.ventas_30d} unidades</p>
                    {row.stock !== null && dailySales !== null && dailySales > 0 ? (
                      <>
                        <p>Velocidad: {dailySales.toFixed(1)} und/día</p>
                        {stockIntel && daysStock !== null ? (
                          <p>
                            Días de stock: {daysStock} →{" "}
                            <span className="font-bold uppercase">
                              {stockIntel.status === "critico"
                                ? "CRÍTICO"
                                : stockIntel.status === "reponer"
                                  ? "REPONER"
                                  : stockIntel.status === "exceso"
                                    ? "EXCESO"
                                    : "OK"}
                            </span>
                          </p>
                        ) : null}
                        {row.stock === 0 ? (
                          <p>
                            Días de stock: 0 → <span className="font-bold uppercase">CRÍTICO</span>
                          </p>
                        ) : null}
                      </>
                    ) : row.stock !== null ? (
                      <p>Velocidad: 0 und/día (sin ventas en 30d)</p>
                    ) : null}
                    {row.stock !== null && stockIntel && stockIntel.units_to_buy > 0 ? (
                      <p>Reponer: {stockIntel.units_to_buy} unidades</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p>Ventas 30d: Sincronizando…</p>
                    <p className="text-[#6B6B6B]">Estado: Se calculará tras el próximo sync</p>
                  </>
                )}
                {row.permalink ? (
                  <p>
                    <a href={row.permalink} className="font-semibold text-blue-700 underline" target="_blank" rel="noreferrer">
                      Abrir en ML
                    </a>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#E8E8E2] bg-white p-3">
              {row.tiene_costo ? (
                <div>
                  <p className="text-sm font-semibold">Vincular a otro SKU de costos</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select value={linkId} onChange={(e) => setLinkId(e.target.value)} className="rounded border border-[#E8E8E2] px-2 py-1 text-sm">
                      <option value="">Elegí SKU…</option>
                      {pricingSkuChoices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {(p.sku ?? p.producto).slice(0, 40)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending || !linkId}
                      className="rounded-lg bg-[#1A1A1A] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={() => {
                        startTransition(async () => {
                          const res = await linkSkuToItem(mlAccountId, row.item_id, linkId);
                          if (!res.success) {
                            setHint(res.error ?? "No se pudo vincular");
                            return;
                          }
                          setLinkId("");
                          onSaved();
                        });
                      }}
                    >
                      Vincular
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#6B6B6B]">Configurá costo desde la columna Acción.</p>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

const LOGISTICA_OPTIONS: LogisticaType[] = ["Flex", "Full", "Retiro domicilio"];
const REP_OPTIONS: ReputacionType[] = ["Verde / MercadoLíder", "Naranja o Roja"];

function InlinePriceCalculator({
  row,
  mlAccountId,
  pending,
  margenObjDefault,
  onClose,
  onSaved,
  startTransition,
  setHint
}: {
  row: UnifiedCatalogItem;
  mlAccountId: string;
  pending: boolean;
  margenObjDefault: number;
  onClose: () => void;
  onSaved: () => void;
  startTransition: (cb: () => Promise<void>) => void;
  setHint: (s: string | null) => void;
}) {
  const defaultCost = row.costo !== null && row.costo > 0 ? String(Math.round(row.costo)) : "";
  const defaultPub =
    row.publicidad_pct !== null && row.publicidad_pct !== undefined
      ? String(normalizePct(row.publicidad_pct) * 100)
      : "0";
  const defaultMarg =
    row.margen_pct !== null && row.margen_pct !== undefined
      ? String(Math.round(normalizePct(row.margen_pct) * 1000) / 10)
      : String(Math.round(margenObjDefault * 1000) / 10);

  const [costoStr, setCostoStr] = useState(defaultCost);
  const [pubStr, setPubStr] = useState(defaultPub);
  const [margStr, setMargStr] = useState(defaultMarg);
  const [logistica, setLogistica] = useState<LogisticaType>((row.logistica ?? "Flex") as LogisticaType);
  const [reputacion, setReputacion] = useState<ReputacionType>(coerceReputacion(row.reputacion));

  const sim = useMemo(() => {
    const costo = Number(costoStr.replace(",", "."));
    const pub = normalizePct(Number(pubStr.replace(",", ".")));
    const marg = normalizePct(Number(margStr.replace(",", ".")));
    if (!Number.isFinite(costo) || costo <= 0) {
      return null;
    }
    const sell = calcSellingPrice({
      costo,
      logistica,
      publicidad_pct: pub,
      margen_pct: marg > 0 ? marg : 0.15,
      reputacion
    });
    const realAtMl =
      row.price_ml !== null && Number.isFinite(row.price_ml)
        ? calcRealProfit({
            price_ml: row.price_ml,
            costo,
            logistica,
            reputacion,
            publicidad_pct: pub,
            peso_kg: row.peso_kg
          })
        : null;
    return { sell, realAtMl, costo, pub, marg: marg > 0 ? marg : 0.15 };
  }, [costoStr, pubStr, margStr, logistica, reputacion, row.price_ml, row.peso_kg]);

  const deltaVsMl =
    sim?.sell.converged && row.price_ml !== null && Number.isFinite(row.price_ml)
      ? row.price_ml - sim.sell.precio_venta
      : null;

  const margenRealSim =
    sim?.sell.converged && Number.isFinite(sim.sell.precio_venta) && sim.costo > 0
      ? calcRealProfit({
          price_ml: sim.sell.precio_venta,
          costo: sim.costo,
          logistica,
          reputacion,
          publicidad_pct: sim.pub,
          peso_kg: row.peso_kg
        })
      : null;

  return (
    <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">Calculadora de precio</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#6B6B6B]">Entradas</p>
          <label className="block text-xs font-semibold text-[#6B6B6B]">
            Costo
            <input
              type="number"
              className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1.5 text-sm"
              value={costoStr}
              onChange={(e) => setCostoStr(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-[#6B6B6B]">
            Publicidad %
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1.5 text-sm"
              value={pubStr}
              onChange={(e) => setPubStr(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-[#6B6B6B]">
            Margen obj. %
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1.5 text-sm"
              value={margStr}
              onChange={(e) => setMargStr(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-[#6B6B6B]">
            Logística
            <select
              className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1.5 text-sm"
              value={logistica}
              onChange={(e) => setLogistica(e.target.value as LogisticaType)}
            >
              {LOGISTICA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#6B6B6B]">
            Reputación
            <select
              className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1.5 text-sm"
              value={reputacion}
              onChange={(e) => setReputacion(e.target.value as ReputacionType)}
            >
              {REP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="space-y-2 rounded-lg bg-[#F5F5F0] p-3 text-sm">
          <p className="text-xs font-semibold text-[#6B6B6B]">Resultado (simulación)</p>
          {sim?.sell.converged && Number.isFinite(sim.sell.precio_venta) ? (
            <>
              <p className="flex justify-between">
                <span>Precio de venta</span>
                <span className="font-mono font-semibold">{ars.format(sim.sell.precio_venta)}</span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>Ganancia (objetivo)</span>
                <span className="font-mono">{ars.format(sim.sell.ganancia_unit)}</span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>Margen real (a ese precio)</span>
                <span className="font-mono">
                  {margenRealSim?.converged ? `${(margenRealSim.margen_real * 100).toFixed(1)}%` : "—"}
                </span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>ROI</span>
                <span className="font-mono">{sim.sell.roi.toFixed(1)}%</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-[#6B6B6B]">Ingresá un costo válido para ver el resultado.</p>
          )}
          {deltaVsMl !== null && Number.isFinite(deltaVsMl) && row.price_ml !== null ? (
            <p className="mt-2 border-t border-[#E8E8E2] pt-2 text-xs text-[#1A1A1A]">
              vs. precio ML actual: ML {ars.format(row.price_ml)}{" "}
              {deltaVsMl > 0 ? (
                <span className="text-orange-800">
                  ↑ {ars.format(Math.abs(deltaVsMl))} más alto que el objetivo
                </span>
              ) : deltaVsMl < 0 ? (
                <span className="text-emerald-800">
                  ↓ {ars.format(Math.abs(deltaVsMl))} más bajo que el objetivo
                </span>
              ) : (
                <span>— alineado</span>
              )}
            </p>
          ) : null}
          {row.price_ml !== null && sim?.realAtMl?.converged ? (
            <p className="text-xs text-[#6B6B6B]">
              Ganancia a precio ML actual: {ars.format(sim.realAtMl.ganancia_real)} (
              {(sim.realAtMl.margen_real * 100).toFixed(1)}%)
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E8E8E2] pt-3">
        <div className="flex flex-wrap gap-2">
          {row.permalink ? (
            <a
              href={row.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-blue-700 underline"
            >
              Abrir publicación en ML →
            </a>
          ) : null}
          <button type="button" className="text-sm font-semibold text-[#6B6B6B] underline" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg bg-[#FFD600] px-3 py-2 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
          onClick={() => {
            const costo = Number(costoStr.replace(",", "."));
            if (!Number.isFinite(costo) || costo <= 0) {
              setHint("Ingresá un costo válido para guardar.");
              return;
            }
            const margen_pct = normalizePct(Number(margStr.replace(",", ".")));
            if (!Number.isFinite(margen_pct) || margen_pct <= 0) {
              setHint("Ingresá un margen objetivo para calcular el precio.");
              return;
            }
            const publicidad_pct = normalizePct(Number(pubStr.replace(",", ".")));
            setHint(null);
            startTransition(async () => {
              const res = await saveCostForItem(mlAccountId, row.item_id, {
                costo,
                logistica,
                margen_pct,
                publicidad_pct,
                reputacion
              });
              if (!res.success) {
                setHint(res.error ?? "No se pudo guardar");
                return;
              }
              onClose();
              onSaved();
            });
          }}
        >
          Guardar configuración
        </button>
      </div>
    </div>
  );
}
