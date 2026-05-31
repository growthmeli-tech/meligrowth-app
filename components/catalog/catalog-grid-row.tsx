"use client";

import { memo, useRef, type CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { cn } from "@/lib/utils";
import { netMarginDisplayLabel } from "@/lib/pricing/profit-labels";
import { toProfitDisplay } from "@/lib/pricing/financial-display";
import type { RowActionModel } from "@/lib/pricing/row-action-model";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** Must match header grid in `catalog-command-center.tsx`. */
export const CATALOG_GRID_ROW_CLASS =
  "grid w-full grid-cols-[minmax(0,1fr)_88px_minmax(112px,1fr)] gap-0 text-left text-sm align-top sm:min-w-[1060px] sm:grid-cols-[32px_48px_minmax(200px,2fr)_72px_96px_72px_88px_120px_minmax(120px,1fr)_40px]";

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
  rowAction: RowActionModel;
  expanded: boolean;
  selected: boolean;
  pending: boolean;
  inlineCostOpen: boolean;
  inlineCalcOpen: boolean;
  margenObjDefault: number | null;
  costForm: { costo: string; logistica: string; margen: string; pub: string } | null;
  rowHint: string | null;
  rowSaveState: "idle" | "saving" | "saved" | "error";
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleInlineCost: () => void;
  onInlineCostFieldChange: (patch: Partial<{ costo: string; logistica: string; margen: string; pub: string }>) => void;
  onInlineCostSave: () => void;
  onInlineCostCancel: () => void;
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
    a.rowHint === b.rowHint &&
    a.rowSaveState === b.rowSaveState &&
    a.costForm?.costo === b.costForm?.costo &&
    a.costForm?.logistica === b.costForm?.logistica &&
    a.costForm?.margen === b.costForm?.margen &&
    a.costForm?.pub === b.costForm?.pub &&
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
  costForm,
  rowHint,
  rowSaveState,
  onToggleSelect,
  onToggleExpand,
  onToggleInlineCost,
  onInlineCostFieldChange,
  onInlineCostSave,
  onInlineCostCancel,
  onOpenMlPushRow
}: CatalogGridRowOwnProps) {
  const dbg = useRef(0);
  if (MG_DEBUG) {
    dbg.current += 1;
    console.debug(`[catalog-grid-row] ${row.item_id} render #${dbg.current}`);
  }

  const ds = row.decisionState;

  const profitDisplay = toProfitDisplay(ds.computed);
  const gananciaRealLabel =
    !row.tiene_costo || row.costo === null || profitDisplay.kind === "unavailable"
      ? "—"
      : `${profitDisplay.kind === "estimated" ? "≈ " : ""}${ars.format(profitDisplay.amount)}`;

  const margenRealLabel =
    !row.tiene_costo || profitDisplay.kind === "unavailable"
      ? "—"
      : `${profitDisplay.marginPct === null ? "—" : `${(profitDisplay.marginPct * 100).toFixed(1)}%`} ${
          profitDisplay.kind === "estimated" ? "estimado" : "real"
        }${netMarginDisplayLabel(ds.computed) ? ` · ${netMarginDisplayLabel(ds.computed)}` : ""}`;

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
      <div role="cell" className="hidden items-start p-2 sm:flex">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Seleccionar ${row.item_id}`} />
      </div>
      <div role="cell" className="hidden p-2 sm:block">
        {row.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- ML CDN thumbnails
          <img src={row.thumbnail} alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <span className="text-xs text-[#6B6B6B]">—</span>
        )}
      </div>
      <div role="cell" className="min-h-0 min-w-0 overflow-hidden p-2">
        <div className="line-clamp-2 font-semibold leading-snug text-[#1A1A1A]">{row.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-xs text-[#6B6B6B]">
          <span
            className="select-none"
            title={`Operabilidad: ${row.dataTrust.operabilityStatus} · Confianza: ${row.dataTrust.decisionConfidence.level}${
              row.dataTrust.decisionConfidence.reasons.length
                ? ` · ${row.dataTrust.decisionConfidence.reasons.slice(0, 5).join("; ")}`
                : ""
            }`}
          >
            {row.dataTrust.operabilityStatus === "operable" ? "🟢" : row.dataTrust.operabilityStatus === "partial" ? "🟡" : "🔴"}
          </span>
          <span>{row.item_id}</span>
        </div>
        {row.sku ? <div className="text-xs text-[#6B6B6B]">SKU costos: {row.sku}</div> : null}
        {!row.tiene_costo ? (
          <span className="mt-2 inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800">
            Sin costo
          </span>
        ) : null}
      </div>
      <div role="cell" className="hidden p-2 sm:block">
        <span className={cn(stockBadgeClass)}>{row.stock === null ? "—" : row.stock}</span>
      </div>
      <div role="cell" className={cn("p-2 tabular-nums", precioCellClass)}>
        {row.price_ml === null ? "—" : ars.format(row.price_ml)}
      </div>
      <div role="cell" className="hidden p-2 text-xs font-medium text-[#1A1A1A] sm:block" title="Envío ML (publicación, datos ML)">
        {row.mlOfficial.publicationLogisticsLabel}
      </div>
      <div role="cell" className="hidden p-2 tabular-nums sm:block">
        {row.costo === null ? "—" : ars.format(row.costo)}
      </div>
      <div role="cell" className="hidden p-2 tabular-nums sm:block">
        <div className="font-medium">{gananciaRealLabel}</div>
        <div className="text-xs text-[#6B6B6B]">{margenRealLabel}</div>
      </div>
      <div role="cell" className="min-h-0 min-w-0 p-2 text-xs">
        <div className="flex flex-col gap-1">
          {rowAction.primaryAction === "configure_cost" ? (
            <button
              type="button"
              className="text-left font-semibold text-[#1A1A1A] underline decoration-[#1A1A1A] underline-offset-2"
              onClick={onToggleInlineCost}
            >
              {rowAction.label}
            </button>
          ) : rowAction.primaryAction === "edit_cost" ? (
            <button
              type="button"
              className="text-left font-semibold text-[#1A1A1A] underline decoration-[#1A1A1A] underline-offset-2"
              onClick={onToggleInlineCost}
            >
              {rowAction.label}
            </button>
          ) : rowAction.primaryAction === "complete_data" ? (
            <span className="text-left font-semibold text-[#1A1A1A]">{rowAction.label}</span>
          ) : rowAction.primaryAction === "none" ? (
            <span className="text-[#6B6B6B]">{rowAction.label}</span>
          ) : null}

          {rowAction.primaryAction === "push_ml_price" && rowAction.canPushMlPrice && rowAction.pushMlPricePayload ? (
            <button
              type="button"
              disabled={pending}
              className="mt-1 rounded-lg border border-[#1A1A1A] bg-[#FFD600] px-2 py-1 text-left font-semibold text-[#1A1A1A] disabled:opacity-50"
              onClick={() => onOpenMlPushRow(row.item_id)}
            >
              {rowAction.pushMlPriceLabel}
            </button>
          ) : rowAction.primaryAction !== "configure_cost" && rowAction.primaryAction !== "push_ml_price" ? (
            <span className="mt-1 text-[10px] font-medium text-[#6B6B6B]">{rowAction.sublabel ?? rowAction.blockedReason ?? "Sin acción"}</span>
          ) : null}
          {inlineCostOpen ? (
            <div className="mt-1 space-y-1 rounded border border-[#E8E8E2] bg-[#FAFAF8] p-2">
              <label className="block">
                <span className="text-[10px] font-semibold text-[#6B6B6B]">Costo</span>
                <input
                  autoFocus
                  type="number"
                  className="mt-0.5 w-full rounded border border-[#E8E8E2] px-1 py-1 text-xs"
                  value={costForm?.costo ?? ""}
                  onChange={(e) => onInlineCostFieldChange({ costo: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onInlineCostSave();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onInlineCostCancel();
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.value.trim()) return;
                    onInlineCostSave();
                  }}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-[#6B6B6B]">Log. costos</span>
                <select
                  className="mt-0.5 w-full rounded border border-[#E8E8E2] px-1 py-1 text-xs"
                  value={costForm?.logistica ?? "Flex"}
                  onChange={(e) => onInlineCostFieldChange({ logistica: e.target.value })}
                >
                  <option value="Flex">Flex</option>
                  <option value="Full">Full</option>
                  <option value="Retiro domicilio">Retiro</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-[#6B6B6B]">Ads %</span>
                <input
                  type="number"
                  step="0.01"
                  className="mt-0.5 w-full rounded border border-[#E8E8E2] px-1 py-1 text-xs"
                  value={costForm?.pub ?? "0"}
                  onChange={(e) => onInlineCostFieldChange({ pub: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-[#6B6B6B]">Margen %</span>
                <input
                  type="number"
                  step="0.01"
                  className="mt-0.5 w-full rounded border border-[#E8E8E2] px-1 py-1 text-xs"
                  value={costForm?.margen ?? ""}
                  onChange={(e) => onInlineCostFieldChange({ margen: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onInlineCostSave();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      onInlineCostCancel();
                    }
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="rounded bg-[#FFD600] px-2 py-0.5 text-[10px] font-semibold" onClick={onInlineCostSave}>
                  Guardar
                </button>
                <button type="button" className="rounded border border-[#E8E8E2] px-2 py-0.5 text-[10px] font-semibold" onClick={onInlineCostCancel}>
                  Cancelar
                </button>
              </div>
              {rowSaveState === "saving" ? <p className="text-[10px] font-semibold text-[#6B6B6B]">Saving...</p> : null}
              {rowSaveState === "saved" ? <p className="text-[10px] font-semibold text-emerald-700">Guardado</p> : null}
              {rowSaveState === "error" && rowHint ? <p className="text-[10px] font-semibold text-red-700">{rowHint}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div role="cell" className="hidden p-2 sm:block">
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
