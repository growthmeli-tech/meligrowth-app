"use client";

import { memo, useRef, type CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { formatMlLogisticsLabel } from "@/lib/pricing/shipping-costs-argentina";
import { cn } from "@/lib/utils";
import { netMarginDisplayLabel } from "@/lib/pricing/profit-labels";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** Must match header grid in `catalog-command-center.tsx`. */
export const CATALOG_GRID_ROW_CLASS =
  "grid w-full min-w-[1060px] grid-cols-[32px_48px_minmax(200px,2fr)_72px_96px_72px_88px_120px_minmax(120px,1fr)_40px] gap-0 text-left text-sm align-top";

/** Fixed virtual row height (main row only; detail panels render below the list). */
export const CATALOG_MAIN_ROW_HEIGHT = 76;

const MG_DEBUG = process.env.NEXT_PUBLIC_MG_CATALOG_ROW_RENDER_DEBUG === "1";

function isCriticoRow(row: UnifiedCatalogItem): boolean {
  return (
    row.decisionState.decision.stockStatus === "critical" ||
    row.stock_status === "critico" ||
    (row.status === "active" && row.stock === 0)
  );
}

export type CatalogGridRowAction =
  | { kind: "calc"; reason: "pierde" | "optimizar" | "subir" }
  | { kind: "sin_stock" }
  | { kind: "config_cost" }
  | { kind: "edit_cost" }
  | { kind: "none" };

export type CatalogGridRowOwnProps = {
  style: CSSProperties;
  rowId: string;
  rowKey: string;
  draftKey: string;
  mlKey: string;
  saveStatus: "idle" | "pending";
  error: string | null;
  row: UnifiedCatalogItem;
  rowActionKey: string;
  rowAction: CatalogGridRowAction;
  expanded: boolean;
  selected: boolean;
  pending: boolean;
  inlineCostOpen: boolean;
  inlineCalcOpen: boolean;
  margenObjDefault: number | null;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleInlineCost: () => void;
  onOpenInlineCalc: () => void;
  onOpenMlPushRow: (itemId: string) => void;
};

function styleSliceEqual(a: CSSProperties, b: CSSProperties): boolean {
  return a.top === b.top && a.height === b.height;
}

function catalogGridRowAreEqual(a: CatalogGridRowOwnProps, b: CatalogGridRowOwnProps): boolean {
  return (
    a.rowId === b.rowId &&
    a.row === b.row &&
    a.rowKey === b.rowKey &&
    a.draftKey === b.draftKey &&
    a.mlKey === b.mlKey &&
    a.saveStatus === b.saveStatus &&
    a.error === b.error &&
    a.expanded === b.expanded &&
    a.selected === b.selected &&
    a.inlineCostOpen === b.inlineCostOpen &&
    a.inlineCalcOpen === b.inlineCalcOpen &&
    a.margenObjDefault === b.margenObjDefault &&
    a.pending === b.pending &&
    a.rowActionKey === b.rowActionKey &&
    styleSliceEqual(a.style, b.style)
  );
}

function CatalogGridRowInner({
  style,
  row,
  rowAction,
  expanded,
  selected,
  pending,
  inlineCostOpen,
  onToggleSelect,
  onToggleExpand,
  onToggleInlineCost,
  onOpenInlineCalc,
  onOpenMlPushRow
}: CatalogGridRowOwnProps) {
  const dbg = useRef(0);
  if (MG_DEBUG) {
    dbg.current += 1;
    console.debug(`[catalog-grid-row] ${row.item_id} render #${dbg.current}`);
  }

  const ds = row.decisionState;

  const gananciaRealLabel =
    !row.tiene_costo || row.costo === null
      ? "—"
      : ds.computed.realProfit !== null && Number.isFinite(ds.computed.realProfit)
        ? ars.format(ds.computed.realProfit)
        : "—";

  const margenRealLabel =
    !row.tiene_costo || ds.computed.realMarginPct === null
      ? "—"
      : `${(ds.computed.realMarginPct * 100).toFixed(1)}% real${
          netMarginDisplayLabel(ds.computed) ? ` · ${netMarginDisplayLabel(ds.computed)}` : ""
        }`;

  const pierde = ds.decision.profitabilityStatus === "loss";
  const riesgoMargen = ds.decision.profitabilityStatus === "risk" || ds.decision.profitabilityStatus === "low_margin";

  const stockEsCriticoVisual = isCriticoRow(row);

  const rowBg = !row.tiene_costo ? "bg-neutral-50/80" : pierde ? "bg-red-50" : "";

  const borderLeft = stockEsCriticoVisual
    ? "border-l-4 border-l-red-500"
    : riesgoMargen && !pierde
      ? "border-l-4 border-l-amber-400"
      : "border-l-4 border-l-transparent";

  const precioCellClass = row.precio_vs_objetivo === "bajo" ? "bg-orange-50 font-semibold text-orange-950" : "";

  const stockSt = ds.decision.stockStatus;

  const canPushMlPrice =
    row.status === "active" &&
    row.tiene_costo &&
    row.precio_calculado !== null &&
    row.price_ml !== null &&
    Number.isFinite(row.precio_calculado) &&
    Number.isFinite(row.price_ml) &&
    Math.round(row.precio_calculado) !== Math.round(row.price_ml);

  const stockBadgeClass =
    row.status === "active" && row.stock === 0
      ? "rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
      : stockSt === "critical"
        ? "rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
        : stockSt === "replenish"
          ? "rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white"
          : "";

  return (
    <div
      role="row"
      style={{ ...style, boxSizing: "border-box" }}
      className={cn("box-border border-b border-[#E8E8E2]", CATALOG_GRID_ROW_CLASS, rowBg, borderLeft)}
    >
      <div role="cell" className="flex items-start p-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Seleccionar ${row.item_id}`} />
      </div>
      <div role="cell" className="p-2">
        {row.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- ML CDN thumbnails
          <img src={row.thumbnail} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <span className="text-xs text-[#6B6B6B]">—</span>
        )}
      </div>
      <div role="cell" className="min-h-0 min-w-0 overflow-hidden p-2">
        <div className="line-clamp-2 font-semibold leading-snug text-[#1A1A1A]">{row.title}</div>
        <div className="mt-1 font-mono text-xs text-[#6B6B6B]">{row.item_id}</div>
        {row.sku ? <div className="text-xs text-[#6B6B6B]">SKU costos: {row.sku}</div> : null}
        {!row.tiene_costo ? (
          <span className="mt-2 inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800">
            Sin costo
          </span>
        ) : null}
      </div>
      <div role="cell" className="p-2">
        <span className={cn(stockBadgeClass)}>{row.stock === null ? "—" : row.stock}</span>
      </div>
      <div role="cell" className={cn("p-2 tabular-nums", precioCellClass)}>
        {row.price_ml === null ? "—" : ars.format(row.price_ml)}
      </div>
      <div role="cell" className="p-2 text-xs font-medium text-[#1A1A1A]">
        {formatMlLogisticsLabel(row.mlOfficial.shippingMode, row.decisionState.ml.freeShipping)}
      </div>
      <div role="cell" className="p-2 tabular-nums">
        {row.costo === null ? "—" : ars.format(row.costo)}
      </div>
      <div role="cell" className="p-2 tabular-nums">
        <div className="font-medium">{gananciaRealLabel}</div>
        <div className="text-xs text-[#6B6B6B]">{margenRealLabel}</div>
      </div>
      <div role="cell" className="min-h-0 min-w-0 p-2 text-xs">
        <div className="flex flex-col gap-1">
          {rowAction.kind === "config_cost" ? (
            <button
              type="button"
              className="text-left font-semibold text-[#1A1A1A] underline decoration-[#1A1A1A] underline-offset-2"
              onClick={onToggleInlineCost}
            >
              Configurar →
            </button>
          ) : rowAction.kind === "edit_cost" ? (
            <button
              type="button"
              className="text-left font-semibold text-[#1A1A1A] underline decoration-[#1A1A1A] underline-offset-2"
              onClick={onToggleInlineCost}
            >
              Editar costo →
            </button>
          ) : rowAction.kind === "sin_stock" ? (
            <span className="font-semibold text-amber-900">⚠ Sin stock</span>
          ) : rowAction.kind === "calc" ? (
            <button
              type="button"
              className={cn(
                "text-left font-semibold underline underline-offset-2",
                rowAction.reason === "pierde" ? "text-red-800 decoration-red-800" : "text-[#1A1A1A] decoration-[#1A1A1A]"
              )}
              onClick={onOpenInlineCalc}
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
            <button
              type="button"
              disabled={pending}
              className="mt-1 rounded-lg border border-[#1A1A1A] bg-[#FFD600] px-2 py-1 text-left font-semibold text-[#1A1A1A] disabled:opacity-50"
              onClick={() => onOpenMlPushRow(row.item_id)}
            >
              ↑ ML: {ars.format(row.price_ml)} → {ars.format(row.precio_calculado)}
            </button>
          ) : null}
        </div>
      </div>
      <div role="cell" className="p-2">
        <button
          type="button"
          onClick={onToggleExpand}
          className="grid place-items-center rounded border border-[#E8E8E2] p-1"
          aria-expanded={expanded}
        >
          <span className="sr-only">Detalle</span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export const CatalogGridRowMemo = memo(CatalogGridRowInner, catalogGridRowAreEqual);
