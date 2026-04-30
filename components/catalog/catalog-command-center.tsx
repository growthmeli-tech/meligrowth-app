"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { ChevronDown, ChevronRight, Download, Filter, RefreshCw } from "lucide-react";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { mergeCatalogRowAfterCostSave, mergeCatalogRowAfterMlPricePush } from "@/lib/data-v2/unified-catalog";
import { getCachedDecisionState, invalidateDecisionCacheBySkuId } from "@/lib/pricing/decision-state-cache";
import type { BuildSkuDecisionStateInput } from "@/lib/pricing/sku-decision-state";
import {
  bulkMarkNoAds,
  exportMasterCatalog,
  linkSkuToItem,
  pushOptimalPriceToML,
  reloadCatalogState,
  saveCostForItem,
  triggerCatalogSync
} from "@/app/(ops)/ops/catalog/actions";
import {
  catalogOrderedItems,
  catalogStateFromItems,
  reconcileItemReplace,
  reconcileItemReplaces
} from "@/lib/data-v2/catalog-state";
import {
  makeCatalogFilterImpactKey,
  selectCatalogCounts,
  selectCatalogFilteredIds,
  selectCatalogPromMargenReal,
  selectCatalogVisibleRows
} from "@/lib/data-v2/catalog-selectors";
import {
  CatalogGridRowMemo,
  CATALOG_GRID_ROW_CLASS,
  CATALOG_MAIN_ROW_HEIGHT,
  type CatalogGridRowAction
} from "@/components/catalog/catalog-grid-row";
import { cn } from "@/lib/utils";
import {
  coerceReputacion,
  mlComisionRate,
  normalizePct,
  type LogisticaType,
  type ReputacionType
} from "@/lib/pricing/calculator";
import { netMarginDisplayLabel } from "@/lib/pricing/profit-labels";

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
  const destroyers = items.filter((i) => i.decisionState.decision.profitabilityStatus === "loss" && i.price_ml !== null);
  if (destroyers.length) {
    const x = destroyers[0];
    const ins = x.decisionState.decision.primaryInsight;
    out.push(ins ?? `${x.item_id}: revisá precio o costo.`);
  }
  const sinCosto = items.filter((i) => !i.tiene_costo).length;
  if (sinCosto > 0 && out.length < 2) {
    out.push(`${sinCosto} publicación${sinCosto > 1 ? "es" : ""} sin costo — cargá costo para ver ganancia real.`);
  }
  return out.slice(0, 2);
}

type PillKey = "critico" | "reponer" | "riesgo" | "ok";

function isCriticoRow(row: UnifiedCatalogItem): boolean {
  return (
    row.decisionState.decision.stockStatus === "critical" ||
    row.stock_status === "critico" ||
    (row.status === "active" && row.stock === 0)
  );
}

function resolveRowAction(row: UnifiedCatalogItem):
  | { kind: "calc"; reason: "pierde" | "optimizar" | "subir" }
  | { kind: "sin_stock" }
  | { kind: "config_cost" }
  | { kind: "none" } {
  const d = row.decisionState.decision;
  if (row.tiene_costo && d.profitabilityStatus === "loss") {
    return { kind: "calc", reason: "pierde" };
  }
  if (row.status === "active" && row.stock === 0) {
    return { kind: "sin_stock" };
  }
  if (!row.tiene_costo) {
    return { kind: "config_cost" };
  }
  if (row.tiene_costo && (d.profitabilityStatus === "risk" || d.profitabilityStatus === "low_margin") && row.price_ml !== null) {
    return { kind: "calc", reason: "optimizar" };
  }
  if (row.precio_vs_objetivo === "bajo") {
    return { kind: "calc", reason: "subir" };
  }
  return { kind: "none" };
}

function margenObjDefaultForSimulator(row: UnifiedCatalogItem): number | null {
  if (row.margen_pct !== null && row.margen_pct !== undefined) {
    const n = normalizePct(row.margen_pct);
    return n > 0 && n <= 1 ? n : null;
  }
  return null;
}

export function CatalogCommandCenter({
  mlAccountId,
  initialItems,
  lastSyncedAt,
  pricingSkuChoices,
  loadError
}: Props) {
  const [pending, startTransition] = useTransition();
  /** Catalog dataset (indexed reconciliation). */
  const [catalog, setCatalog] = useState(() => catalogStateFromItems(initialItems));

  useEffect(() => {
    setCatalog(catalogStateFromItems(initialItems));
  }, [initialItems]);

  const items = useMemo(() => catalogOrderedItems(catalog), [catalog]);

  const partitionSkuCacheId = useCallback(
    (row: UnifiedCatalogItem) => row.pricing_sku_id ?? `calc:${mlAccountId}:${row.item_id}`,
    [mlAccountId]
  );

  const onReconcileCostRow = useCallback(
    (
      itemId: string,
      saved: {
        pricing_sku_id: string;
        costo: number;
        logistica: LogisticaType;
        margen_pct: number;
        publicidad_pct: number;
        reputacion: string | null;
      },
      serverItem?: UnifiedCatalogItem | null
    ) => {
      setCatalog((c) => {
        if (serverItem && serverItem.item_id === itemId) {
          if (serverItem.pricing_sku_id) invalidateDecisionCacheBySkuId(serverItem.pricing_sku_id);
          const cid = serverItem.pricing_sku_id ?? `calc:${mlAccountId}:${itemId}`;
          invalidateDecisionCacheBySkuId(cid);
          invalidateDecisionCacheBySkuId(`${cid}:opt`);
          return reconcileItemReplace(c, serverItem);
        }
        const i = c.itemsById[itemId];
        if (!i) return c;
        const cid = partitionSkuCacheId(i);
        invalidateDecisionCacheBySkuId(cid);
        invalidateDecisionCacheBySkuId(`${cid}:opt`);
        invalidateDecisionCacheBySkuId(saved.pricing_sku_id);
        const next = mergeCatalogRowAfterCostSave(mlAccountId, i, saved);
        return reconcileItemReplace(c, next);
      });
    },
    [mlAccountId, partitionSkuCacheId]
  );

  const onReconcileMlPrice = useCallback((itemId: string, newPrice: number) => {
    setCatalog((c) => {
      const cur = c.itemsById[itemId];
      if (!cur) return c;
      if (cur.pricing_sku_id) invalidateDecisionCacheBySkuId(cur.pricing_sku_id);
      const next = mergeCatalogRowAfterMlPricePush(mlAccountId, cur, newPrice);
      return reconcileItemReplace(c, next);
    });
  }, [mlAccountId]);

  const onReconcileFromServer = useCallback(() => {
    startTransition(async () => {
      const res = await reloadCatalogState(mlAccountId);
      if (res.success) setCatalog(res.data);
    });
  }, [mlAccountId, startTransition]);

  const onReconcileLinkSkuRow = useCallback(
    (prevPricingSkuId: string | null, item: UnifiedCatalogItem) => {
      if (prevPricingSkuId) invalidateDecisionCacheBySkuId(prevPricingSkuId);
      if (item.pricing_sku_id) invalidateDecisionCacheBySkuId(item.pricing_sku_id);
      const cid = item.pricing_sku_id ?? `calc:${mlAccountId}:${item.item_id}`;
      invalidateDecisionCacheBySkuId(cid);
      invalidateDecisionCacheBySkuId(`${cid}:opt`);
      setCatalog((c) => reconcileItemReplace(c, item));
    },
    [mlAccountId]
  );
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

  /** Lifted row UI for virtual row memo boundaries (primitives only in list). */
  const [rowHints, setRowHints] = useState<Record<string, string | null>>({});
  const [linkSkuByItemId, setLinkSkuByItemId] = useState<Record<string, string>>({});
  const [mlPushItemId, setMlPushItemId] = useState<string | null>(null);

  const listBodyRef = useRef<HTMLDivElement>(null);
  const [catalogListHeight, setCatalogListHeight] = useState(440);
  useLayoutEffect(() => {
    const el = listBodyRef.current;
    if (!el) return;
    const apply = () => setCatalogListHeight(Math.max(220, Math.min(640, Math.floor(el.clientHeight))));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stale = useMemo(() => {
    if (!lastSyncedAt) return true;
    return Date.now() - new Date(lastSyncedAt).getTime() > 6 * 60 * 60 * 1000;
  }, [lastSyncedAt]);

  const filterKey = useMemo(
    () =>
      makeCatalogFilterImpactKey({
        q,
        statusFilter,
        logFilter,
        margenFilter,
        costFilter,
        stockFilter,
        activePill
      }),
    [q, statusFilter, logFilter, margenFilter, costFilter, stockFilter, activePill]
  );

  const filteredIds = useMemo(
    () =>
      selectCatalogFilteredIds(catalog, {
        q,
        statusFilter,
        logFilter,
        margenFilter,
        costFilter,
        stockFilter,
        activePill
      }),
    [catalog, filterKey]
  );

  const filtered = useMemo(() => selectCatalogVisibleRows(catalog, filteredIds), [catalog, filteredIds]);

  const counts = useMemo(() => selectCatalogCounts(catalog), [catalog]);

  const promMargenReal = useMemo(() => selectCatalogPromMargenReal(catalog), [catalog]);

  const insights = useMemo(() => buildInsights(items), [items]);

  const catalogDetailIdsSorted = useMemo(() => {
    const want = new Set<string>();
    if (expanded) want.add(expanded);
    if (inlineCostItemId) want.add(inlineCostItemId);
    if (inlineCalcItemId) want.add(inlineCalcItemId);
    if (mlPushItemId) want.add(mlPushItemId);
    if (want.size === 0) return [];
    return filteredIds.filter((id) => want.has(id));
  }, [expanded, inlineCostItemId, inlineCalcItemId, mlPushItemId, filteredIds]);

  const togglePill = (key: PillKey) => {
    setActivePill((prev) => (prev === key ? null : key));
  };

  const toggleSelect = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (selected.size === filteredIds.length && filteredIds.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredIds));
  };

  const onSync = () => {
    setSyncHint(null);
    startTransition(async () => {
      const res = await triggerCatalogSync(mlAccountId);
      if (!res.success) {
        setSyncHint(res.error ?? "No se pudo sincronizar");
        return;
      }
      const cat = await reloadCatalogState(mlAccountId);
      if (!cat.success) {
        setSyncHint(cat.error ?? "Sincronizado; no se pudo recargar el catálogo.");
        return;
      }
      setCatalog(cat.data);
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
    const ids: string[] = [];
    for (const fid of filteredIds) {
      if (!selected.has(fid)) continue;
      const row = catalog.itemsById[fid];
      if (row?.pricing_sku_id) ids.push(row.pricing_sku_id);
    }
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
      const serverItems = res.data?.items;
      if (serverItems?.length) {
        setCatalog((prev) => {
          for (const row of serverItems) {
            if (row.pricing_sku_id) invalidateDecisionCacheBySkuId(row.pricing_sku_id);
            const cid = row.pricing_sku_id ?? `calc:${mlAccountId}:${row.item_id}`;
            invalidateDecisionCacheBySkuId(cid);
            invalidateDecisionCacheBySkuId(`${cid}:opt`);
          }
          return reconcileItemReplaces(prev, serverItems);
        });
        return;
      }
      const idSet = new Set(ids);
      setCatalog((prev) => {
        const replaces: UnifiedCatalogItem[] = [];
        for (const itemId of prev.orderedIds) {
          const row = prev.itemsById[itemId];
          if (!row?.pricing_sku_id || !idSet.has(row.pricing_sku_id) || !row.tiene_costo) continue;
          const marg =
            row.margen_pct !== null && row.margen_pct !== undefined ? normalizePct(Number(row.margen_pct)) : null;
          if (marg === null || marg <= 0) continue;
          if (row.pricing_sku_id) invalidateDecisionCacheBySkuId(row.pricing_sku_id);
          const cid = row.pricing_sku_id ?? `calc:${mlAccountId}:${row.item_id}`;
          invalidateDecisionCacheBySkuId(cid);
          invalidateDecisionCacheBySkuId(`${cid}:opt`);
          replaces.push(
            mergeCatalogRowAfterCostSave(mlAccountId, row, {
              pricing_sku_id: row.pricing_sku_id,
              costo: row.costo ?? 0,
              logistica: (row.logistica ?? "Flex") as LogisticaType,
              margen_pct: marg,
              publicidad_pct: 0,
              reputacion: row.reputacion
            })
          );
        }
        return reconcileItemReplaces(prev, replaces);
      });
    });
  };

  const renderCatalogVirtualRow = useCallback(
    ({ index, style }: ListChildComponentProps<Record<string, never>>) => {
      const rowId = filteredIds[index];
      const row = catalog.itemsById[rowId];
      if (!row) return null;
      const draft = costForms[rowId];
      const draftKey = draft
        ? `${draft.costo}\x1f${draft.logistica}\x1f${draft.margen}\x1f${draft.pub}`
        : "";
      const mlKey = `${row.price_ml ?? "∅"}\x1f${row.stock ?? "∅"}\x1f${row.precio_calculado ?? "∅"}\x1f${row.decisionState.decision.profitabilityStatus}\x1f${row.decisionState.decision.stockStatus}`;
      const rowKey = `${row.pricing_sku_id ?? ""}\x1f${row.last_synced_at}`;
      const ra = resolveRowAction(row) as CatalogGridRowAction;
      const rowActionKey = ra.kind === "calc" ? `calc:${ra.reason}` : ra.kind;
      return (
        <CatalogGridRowMemo
          style={style}
          rowId={rowId}
          rowKey={rowKey}
          draftKey={draftKey}
          mlKey={mlKey}
          saveStatus={pending ? "pending" : "idle"}
          error={rowHints[rowId] ?? null}
          row={row}
          rowActionKey={rowActionKey}
          rowAction={ra}
          expanded={expanded === rowId}
          selected={selected.has(rowId)}
          pending={pending}
          inlineCostOpen={inlineCostItemId === rowId}
          inlineCalcOpen={inlineCalcItemId === rowId}
          margenObjDefault={margenObjDefaultForSimulator(row)}
          onToggleSelect={() => toggleSelect(rowId)}
          onToggleExpand={() => {
            setExpanded((e) => (e === rowId ? null : rowId));
            setMlPushItemId(null);
          }}
          onToggleInlineCost={() => {
            setInlineCostItemId((cur) => (cur === rowId ? null : rowId));
            setInlineCalcItemId(null);
            setMlPushItemId(null);
          }}
          onOpenInlineCalc={() => {
            setInlineCalcItemId(rowId);
            setInlineCostItemId(null);
            setMlPushItemId(null);
          }}
          onOpenMlPushRow={(id) => {
            setMlPushItemId(id);
            setInlineCostItemId(null);
            setInlineCalcItemId(null);
          }}
        />
      );
    },
    [
      filteredIds,
      catalog,
      costForms,
      rowHints,
      expanded,
      selected,
      pending,
      inlineCostItemId,
      inlineCalcItemId
    ]
  );

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
        {filteredIds.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-medium text-[#1A1A1A]">No hay publicaciones sincronizadas.</p>
            <button type="button" disabled={pending} onClick={onSync} className="mt-4 rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold">
              Sincronizar con Mercado Libre
            </button>
          </div>
        ) : (
          <div role="table" aria-label="Catálogo" className="flex min-w-[980px] flex-col text-sm">
            <div
              role="row"
              className={cn(
                CATALOG_GRID_ROW_CLASS,
                "border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]"
              )}
            >
              <div role="columnheader" className="flex items-center p-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas"
                  checked={filteredIds.length > 0 && selected.size === filteredIds.length}
                  onChange={toggleAllFiltered}
                />
              </div>
              <div role="columnheader" className="p-2">
                IMG
              </div>
              <div role="columnheader" className="p-2">
                Producto + MLA
              </div>
              <div role="columnheader" className="p-2">
                Stock
              </div>
              <div role="columnheader" className="p-2">
                Precio ML
              </div>
              <div role="columnheader" className="p-2">
                Costo
              </div>
              <div role="columnheader" className="p-2">
                Ganancia
              </div>
              <div role="columnheader" className="p-2">
                Acción
              </div>
              <div role="columnheader" className="w-8 p-2" />
            </div>
            <div ref={listBodyRef} className="h-[min(55vh,560px)] w-full shrink-0">
              <FixedSizeList
                height={catalogListHeight}
                width="100%"
                itemCount={filteredIds.length}
                itemSize={CATALOG_MAIN_ROW_HEIGHT}
                overscanCount={6}
                itemKey={(index) => filteredIds[index] ?? String(index)}
              >
                {renderCatalogVirtualRow}
              </FixedSizeList>
            </div>
            {catalogDetailIdsSorted.map((id) => {
              const row = catalog.itemsById[id];
              if (!row) return null;
              return (
                <CatalogRows
                  key={id}
                  row={row}
                  expanded={expanded === id}
                  onToggleExpand={() => setExpanded(expanded === id ? null : id)}
                  pending={pending}
                  mlAccountId={mlAccountId}
                  pricingSkuChoices={pricingSkuChoices}
                  costForms={costForms}
                  setCostForms={setCostForms}
                  onReconcileCostRow={onReconcileCostRow}
                  onReconcileMlPrice={onReconcileMlPrice}
                  onReconcileLinkSkuRow={onReconcileLinkSkuRow}
                  onReconcileFromServer={onReconcileFromServer}
                  startTransition={startTransition}
                  inlineCostOpen={inlineCostItemId === id}
                  setInlineCostOpen={(v) => setInlineCostItemId(v ? id : null)}
                  inlineCalcOpen={inlineCalcItemId === id}
                  setInlineCalcOpen={(v) => setInlineCalcItemId(v ? id : null)}
                  margenObjDefault={margenObjDefaultForSimulator(row)}
                  mlPushItemId={mlPushItemId}
                  onCloseMlPush={() => setMlPushItemId(null)}
                  rowHint={rowHints[id] ?? null}
                  onRowHint={(msg) =>
                    setRowHints((prev) => {
                      if (prev[id] === msg) return prev;
                      return { ...prev, [id]: msg };
                    })
                  }
                  linkSkuValue={linkSkuByItemId[id] ?? ""}
                  onLinkSkuValue={(v) => setLinkSkuByItemId((prev) => ({ ...prev, [id]: v }))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogRows({
  row,
  expanded,
  onToggleExpand,
  pending,
  mlAccountId,
  pricingSkuChoices,
  costForms,
  setCostForms,
  onReconcileCostRow,
  onReconcileMlPrice,
  onReconcileLinkSkuRow,
  onReconcileFromServer,
  startTransition,
  inlineCostOpen,
  setInlineCostOpen,
  inlineCalcOpen,
  setInlineCalcOpen,
  margenObjDefault,
  mlPushItemId,
  onCloseMlPush,
  rowHint,
  onRowHint,
  linkSkuValue,
  onLinkSkuValue
}: {
  row: UnifiedCatalogItem;
  expanded: boolean;
  onToggleExpand: () => void;
  pending: boolean;
  mlAccountId: string;
  pricingSkuChoices: PricingChoice[];
  costForms: Record<string, { costo: string; logistica: string; margen: string; pub: string }>;
  setCostForms: Dispatch<SetStateAction<Record<string, { costo: string; logistica: string; margen: string; pub: string }>>>;
  onReconcileCostRow: (
    itemId: string,
    saved: {
      pricing_sku_id: string;
      costo: number;
      logistica: LogisticaType;
      margen_pct: number;
      publicidad_pct: number;
      reputacion: string | null;
    },
    serverItem?: UnifiedCatalogItem | null
  ) => void;
  onReconcileMlPrice: (itemId: string, newPrice: number) => void;
  onReconcileLinkSkuRow: (prevPricingSkuId: string | null, item: UnifiedCatalogItem) => void;
  onReconcileFromServer: () => void;
  startTransition: (cb: () => Promise<void>) => void;
  inlineCostOpen: boolean;
  setInlineCostOpen: (open: boolean) => void;
  inlineCalcOpen: boolean;
  setInlineCalcOpen: (open: boolean) => void;
  margenObjDefault: number | null;
  mlPushItemId: string | null;
  onCloseMlPush: () => void;
  rowHint: string | null;
  onRowHint: (msg: string | null) => void;
  linkSkuValue: string;
  onLinkSkuValue: (v: string) => void;
}) {
  const ds = row.decisionState;
  const rep = coerceReputacion(row.reputacion);

  const dailySales = ds.computed.velocity30d;
  const daysStock = ds.computed.daysOfStock;
  const stockSt = ds.decision.stockStatus;
  const unitsToBuy =
    ds.computed.stockGap !== null && Number.isFinite(ds.computed.stockGap) && ds.computed.stockGap > 0
      ? Math.ceil(ds.computed.stockGap)
      : 0;

  const canPushMlPrice =
    row.status === "active" &&
    row.tiene_costo &&
    row.precio_calculado !== null &&
    row.price_ml !== null &&
    Number.isFinite(row.precio_calculado) &&
    Number.isFinite(row.price_ml) &&
    Math.round(row.precio_calculado) !== Math.round(row.price_ml);

  const comisionPctLabel = `${(mlComisionRate(rep) * 100).toFixed(2)}%`;

  const pierde = ds.decision.profitabilityStatus === "loss";
  const rowBg = !row.tiene_costo ? "bg-neutral-50/80" : pierde ? "bg-red-50" : "";
  const riesgoMargen = ds.decision.profitabilityStatus === "risk" || ds.decision.profitabilityStatus === "low_margin";
  const stockEsCriticoVisual = isCriticoRow(row);
  const borderLeft = stockEsCriticoVisual
    ? "border-l-4 border-l-red-500"
    : riesgoMargen && !pierde
      ? "border-l-4 border-l-amber-400"
      : "border-l-4 border-l-transparent";

  return (
    <>
      {mlPushItemId === row.item_id && canPushMlPrice ? (
        <div className="border-b border-[#E8E8E2] bg-[#FAFAF8] p-4">
          <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-white p-3">
            <p className="font-semibold text-[#1A1A1A]">¿Actualizar precio en ML?</p>
            <p className="tabular-nums text-sm">
              {row.price_ml !== null ? ars.format(row.price_ml) : "—"} →{" "}
              {row.precio_calculado !== null ? ars.format(row.precio_calculado) : "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const res = await pushOptimalPriceToML(mlAccountId, row.item_id, row.precio_calculado!);
                    if (!res.success) {
                      onRowHint(res.error ?? "Error al publicar precio");
                      return;
                    }
                    onCloseMlPush();
                    onRowHint(null);
                    if (res.data) onReconcileMlPrice(row.item_id, res.data.new_price);
                  });
                }}
              >
                Confirmar
              </button>
              <button type="button" className="rounded-lg border border-[#E8E8E2] px-3 py-1.5 text-sm font-semibold" onClick={onCloseMlPush}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inlineCostOpen && !row.tiene_costo ? (
        <div className="border-b border-[#E8E8E2] bg-neutral-50 p-4">
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
            {rowHint ? <p className="mt-2 text-xs text-red-700">{rowHint}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-lg bg-[#FFD600] px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  const f = costForms[row.item_id];
                  const costo = Number(f?.costo);
                  if (!Number.isFinite(costo) || costo <= 0) {
                    onRowHint("Ingresá un costo válido.");
                    return;
                  }
                  const margenStr = f?.margen?.trim() ?? "";
                  if (margenStr === "") {
                    onRowHint("Ingresá un margen objetivo para calcular el precio.");
                    return;
                  }
                  const margen_pct = normalizePct(Number(margenStr));
                  if (!Number.isFinite(margen_pct) || margen_pct <= 0) {
                    onRowHint("Ingresá un margen objetivo para calcular el precio.");
                    return;
                  }
                  const publicidad_pct = normalizePct(Number(f?.pub ?? 0));
                  const logisticaIns = (f?.logistica ?? "Flex") as "Full" | "Flex" | "Retiro domicilio";
                  onRowHint(null);
                  startTransition(async () => {
                    const res = await saveCostForItem(mlAccountId, row.item_id, {
                      costo,
                      logistica: logisticaIns,
                      margen_pct,
                      publicidad_pct
                    });
                    if (!res.success) {
                      onRowHint(res.error ?? "No se pudo guardar");
                      return;
                    }
                    setInlineCostOpen(false);
                    onReconcileCostRow(
                      row.item_id,
                      {
                        pricing_sku_id: res.data.pricing_sku_id,
                        costo,
                        logistica: logisticaIns,
                        margen_pct,
                        publicidad_pct,
                        reputacion: row.reputacion
                      },
                      res.data.item
                    );
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
        </div>
      ) : null}

      {inlineCalcOpen && row.tiene_costo ? (
        <div className="border-b border-[#E8E8E2] bg-[#FAFAF8] p-4">
            <InlinePriceCalculator
              row={row}
              mlAccountId={mlAccountId}
              pending={pending}
                  margenObjDefault={margenObjDefault}
              onClose={() => setInlineCalcOpen(false)}
              onCostRowMerged={(patch, serverItem) => onReconcileCostRow(row.item_id, patch, serverItem)}
              startTransition={startTransition}
              setHint={onRowHint}
            />
            {rowHint ? <p className="mt-2 text-xs text-red-700">{rowHint}</p> : null}
        </div>
      ) : null}

      {expanded ? (
        <div className={cn("border-b border-[#E8E8E2] bg-[#FAFAF8] p-4", rowBg)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-white p-3 text-sm">
                <p className="font-bold text-[#1A1A1A]">Desglose</p>
                {row.price_ml !== null && row.tiene_costo && ds.computed.financialBreakdown !== null ? (
                  <>
                    {netMarginDisplayLabel(ds.computed) ? (
                      <p className="text-xs font-semibold text-amber-900">{netMarginDisplayLabel(ds.computed)}</p>
                    ) : null}
                    <ul className="space-y-1 font-mono text-xs leading-relaxed">
                      <li className="flex justify-between gap-4">
                        <span>Precio:</span>
                        <span>{ars.format(row.price_ml)}</span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Costo producto:</span>
                        <span>
                          {ds.computed.financialBreakdown.productCost !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.productCost)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Comisión ML {comisionPctLabel}:</span>
                        <span>
                          {ds.computed.financialBreakdown.mlFeeAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.mlFeeAmount)}`
                            : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Costo fijo por unidad:</span>
                        <span>
                          {ds.computed.financialBreakdown.fixedUnitCost !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.fixedUnitCost)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Ads ({(ds.computed.financialBreakdown.adsPct * 100).toFixed(1)}%):</span>
                        <span>− {ars.format(ds.computed.financialBreakdown.adsAmount)}</span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− IIBB:</span>
                        <span>
                          {ds.computed.financialBreakdown.iibbAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.iibbAmount)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Impuestos:</span>
                        <span>
                          {ds.computed.financialBreakdown.taxAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.taxAmount)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− ML envío (variable):</span>
                        <span>
                          {ds.computed.financialBreakdown.mlShippingAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.mlShippingAmount)}`
                            : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− ML fulfillment (fijo estimado):</span>
                        <span>
                          {ds.computed.financialBreakdown.fulfillmentAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.fulfillmentAmount)}`
                            : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Logística interna:</span>
                        <span>
                          {ds.computed.financialBreakdown.internalLogisticsAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.internalLogisticsAmount)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 text-[#6B6B6B]">
                        <span>− Costos adicionales:</span>
                        <span>
                          {ds.computed.financialBreakdown.additionalCostsAmount !== null
                            ? `− ${ars.format(ds.computed.financialBreakdown.additionalCostsAmount)}`
                            : "— (no configurado)"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 border-t border-[#E8E8E2] pt-1 font-semibold text-[#1A1A1A]">
                        <span>Ganancia neta:</span>
                        <span>
                          {ds.computed.financialBreakdown.netProfit !== null &&
                          Number.isFinite(ds.computed.financialBreakdown.netProfit)
                            ? `${ds.computed.financialBreakdown.netProfit >= 0 ? "+" : ""}${ars.format(ds.computed.financialBreakdown.netProfit)}`
                            : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-4 font-semibold text-[#1A1A1A]">
                        <span>Margen neto / parcial:</span>
                        <span>
                          {ds.computed.financialBreakdown.netMarginPct !== null
                            ? `${(ds.computed.financialBreakdown.netMarginPct * 100).toFixed(1)}% · ${netMarginDisplayLabel(ds.computed) || "—"}`
                            : "—"}
                        </span>
                      </li>
                    </ul>
                  </>
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
                        {daysStock !== null ? (
                          <p>
                            Días de stock: {daysStock} →{" "}
                            <span className="font-bold uppercase">
                              {stockSt === "critical"
                                ? "CRÍTICO"
                                : stockSt === "replenish"
                                  ? "REPONER"
                                  : stockSt === "overstock"
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
                    ) : row.stock !== null && row.ventas_30d === 0 ? (
                      <p>Velocidad: 0 und/día (sin ventas en 30d)</p>
                    ) : null}
                    {row.stock !== null && unitsToBuy > 0 ? <p>Reponer: {unitsToBuy} unidades</p> : null}
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
                    <select
                      value={linkSkuValue}
                      onChange={(e) => onLinkSkuValue(e.target.value)}
                      className="rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                    >
                      <option value="">Elegí SKU…</option>
                      {pricingSkuChoices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {(p.sku ?? p.producto).slice(0, 40)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending || !linkSkuValue}
                      className="rounded-lg bg-[#1A1A1A] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={() => {
                        startTransition(async () => {
                          const res = await linkSkuToItem(mlAccountId, row.item_id, linkSkuValue);
                          if (!res.success) {
                            onRowHint(res.error ?? "No se pudo vincular");
                            return;
                          }
                          onLinkSkuValue("");
                          const it = res.data?.item;
                          if (it) onReconcileLinkSkuRow(row.pricing_sku_id, it);
                          else onReconcileFromServer();
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
        </div>
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
  onCostRowMerged,
  startTransition,
  setHint
}: {
  row: UnifiedCatalogItem;
  mlAccountId: string;
  pending: boolean;
  margenObjDefault: number | null;
  onClose: () => void;
  onCostRowMerged: (
    saved: {
      pricing_sku_id: string;
      costo: number;
      logistica: LogisticaType;
      margen_pct: number;
      publicidad_pct: number;
      reputacion: string | null;
    },
    serverItem?: UnifiedCatalogItem | null
  ) => void;
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
      : margenObjDefault !== null
        ? String(Math.round(margenObjDefault * 1000) / 10)
        : "";

  const [costoStr, setCostoStr] = useState(defaultCost);
  const [pubStr, setPubStr] = useState(defaultPub);
  const [margStr, setMargStr] = useState(defaultMarg);
  const [logistica, setLogistica] = useState<LogisticaType>((row.logistica ?? "Flex") as LogisticaType);
  const [reputacion, setReputacion] = useState<ReputacionType>(coerceReputacion(row.reputacion));
  const [debounced, setDebounced] = useState({ costoStr: defaultCost, pubStr: defaultPub, margStr: defaultMarg });

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced({ costoStr, pubStr, margStr }), 120);
    return () => window.clearTimeout(t);
  }, [costoStr, pubStr, margStr]);

  const sim = useMemo(() => {
    const costo = Number(debounced.costoStr.replace(",", "."));
    const pub = normalizePct(Number(debounced.pubStr.replace(",", ".")));
    const margTrim = debounced.margStr.trim();
    const margParsed = margTrim === "" ? null : normalizePct(Number(margTrim.replace(",", ".")));
    if (!Number.isFinite(costo) || costo <= 0) {
      return null;
    }
    const baseInput: BuildSkuDecisionStateInput = {
      accountId: mlAccountId,
      ml: {
        itemId: row.item_id,
        sku: row.sku,
        title: row.title,
        imageUrl: row.thumbnail,
        currentPrice: row.price_ml,
        stock: row.stock,
        ventas30d: row.ventas_30d,
        revenue30d: row.decisionState.ml.revenue30d,
        lastSaleDate: row.decisionState.ml.lastSaleDate,
        shippingMode: row.logistic_type,
        listingType: null,
        freeShipping: null,
        categoryId: null
      },
      inputs: {
        productCost: costo,
        logistics: logistica,
        publicidadPct: pub,
        targetMarginPct: margParsed !== null && margParsed > 0 ? margParsed : null,
        pesoKg: row.peso_kg,
        reputacion
      },
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null }
    };
    const cacheSkuId = row.pricing_sku_id ?? `calc:${mlAccountId}:${row.item_id}`;
    const base = getCachedDecisionState(cacheSkuId, baseInput);
    let marginAtOptimal: number | null = null;
    if (base.computed.optimalPrice !== null && base.computed.optimalPrice > 0) {
      const altSkuId = `${cacheSkuId}:opt`;
      const altInput: BuildSkuDecisionStateInput = {
        ...baseInput,
        ml: { ...baseInput.ml, currentPrice: base.computed.optimalPrice }
      };
      marginAtOptimal = getCachedDecisionState(altSkuId, altInput).computed.realMarginPct;
    }
    return { ds: base, marginAtOptimal, costo, pub };
  }, [
    debounced.costoStr,
    debounced.pubStr,
    debounced.margStr,
    logistica,
    reputacion,
    mlAccountId,
    row.item_id,
    row.sku,
    row.title,
    row.thumbnail,
    row.price_ml,
    row.stock,
    row.ventas_30d,
    row.peso_kg,
    row.logistic_type,
    row.pricing_sku_id,
    row.decisionState.ml.revenue30d,
    row.decisionState.ml.lastSaleDate
  ]);

  const deltaVsMl = (() => {
    const opt = sim?.ds.computed.optimalPrice;
    if (
      opt === null ||
      opt === undefined ||
      row.price_ml === null ||
      !Number.isFinite(row.price_ml) ||
      !Number.isFinite(opt)
    ) {
      return null;
    }
    return row.price_ml - opt;
  })();

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
          {sim && sim.ds.computed.optimalPrice !== null && Number.isFinite(sim.ds.computed.optimalPrice) ? (
            <>
              <p className="flex justify-between">
                <span>Precio de venta</span>
                <span className="font-mono font-semibold">{ars.format(sim.ds.computed.optimalPrice)}</span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>Ganancia (objetivo)</span>
                <span className="font-mono">
                  {sim.ds.computed.optimalGananciaUnit !== null ? ars.format(sim.ds.computed.optimalGananciaUnit) : "—"}
                </span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>Margen real (a ese precio)</span>
                <span className="font-mono">
                  {sim.marginAtOptimal !== null ? `${(sim.marginAtOptimal * 100).toFixed(1)}%` : "—"}
                </span>
              </p>
              <p className="flex justify-between text-[#6B6B6B]">
                <span>ROI</span>
                <span className="font-mono">
                  {sim.ds.computed.optimalRoi !== null ? `${sim.ds.computed.optimalRoi.toFixed(1)}%` : "—"}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-[#6B6B6B]">
              {!Number.isFinite(Number(costoStr.replace(",", "."))) || Number(costoStr.replace(",", ".")) <= 0
                ? "Ingresá un costo válido para ver el resultado."
                : "Ingresá margen objetivo para ver precio de venta."}
            </p>
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
          {row.price_ml !== null && sim && sim.ds.computed.realProfit !== null && Number.isFinite(sim.ds.computed.realProfit) ? (
            <p className="text-xs text-[#6B6B6B]">
              Ganancia a precio ML actual: {ars.format(sim.ds.computed.realProfit)} (
              {sim.ds.computed.realMarginPct !== null ? `${(sim.ds.computed.realMarginPct * 100).toFixed(1)}%` : "—"})
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
              onCostRowMerged(
                {
                  pricing_sku_id: res.data.pricing_sku_id,
                  costo,
                  logistica,
                  margen_pct,
                  publicidad_pct,
                  reputacion
                },
                res.data.item
              );
              onClose();
            });
          }}
        >
          Guardar configuración
        </button>
      </div>
    </div>
  );
}
