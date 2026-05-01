"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import { getCachedDecisionState, invalidateDecisionCacheBySkuId, invalidateDecisionCacheByAccountId, makeDecisionCacheKey, sellerFinancialSettingsFingerprint } from "@/lib/pricing/decision-state-cache";
import {
  selectFilteredPricingRowIds,
  selectHeaderMetrics,
  selectVisiblePricingRows,
  pricingTierFromDecision
} from "@/lib/pricing/pricing-engine-selectors";
import {
  buildPricingRowInput,
  mergePricingMlLink,
  makeDraftImpactKey,
  makeMlLinksImpactKey,
  makeMlOverrideImpactKey,
  makePricingFilterImpactKey,
  pricingDraftFieldsEqual,
  pricingMlLinkFieldsEqual,
  pricingSkuRowFieldsEqual,
  rowToDraft,
  type PricingDraft,
  type PricingSkuRow
} from "@/lib/pricing/pricing-row-model";
import { normalizePct, type LogisticaType, type SellerFinancialSettings } from "@/lib/pricing/calculator";
import { netMarginDisplayLabel } from "@/lib/pricing/profit-labels";
import { formatMlLogisticsPublicationLabel } from "@/lib/pricing/ml-official-data-contract";
import { canTriggerMlPricePush, toCashInDisplay, toOptimalPriceDisplay, toProfitDisplay } from "@/lib/pricing/financial-display";
import { savePricingSkuInputs } from "@/app/(ops)/ops/pricing/actions";
import { pushOptimalPriceToML } from "@/app/(ops)/ops/catalog/actions";
import { AccountFiscalConfigPanel } from "@/components/pricing/account-fiscal-config-panel";
import { cn } from "@/lib/utils";

type Props = {
  rows: PricingSkuRow[];
  mlLinks?: Record<string, MlPublicationLink>;
  mlAccountId: string;
  initialFinancialSettings: SellerFinancialSettings | null;
};

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

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

export function PricingEngineTable({ rows, mlLinks, mlAccountId, initialFinancialSettings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [financialSettings, setFinancialSettings] = useState<SellerFinancialSettings | null>(initialFinancialSettings);

  useEffect(() => {
    setFinancialSettings(initialFinancialSettings);
  }, [mlAccountId, initialFinancialSettings]);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "destroy" | "risk">("all");
  const [drafts, setDrafts] = useState<Record<string, PricingDraft>>({});
  const savedSnapshot = useRef<Record<string, PricingDraft>>({});
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ skuId: string; field: keyof PricingDraft } | null>(null);
  const [mlPriceOverrideBySku, setMlPriceOverrideBySku] = useState<Record<string, number>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({});

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const rowsByIdRef = useRef(rowsById);
  rowsByIdRef.current = rowsById;

  useEffect(() => {
    const next: Record<string, PricingDraft> = {};
    for (const r of rows) {
      next[r.id] = rowToDraft(r);
    }
    setDrafts(next);
    savedSnapshot.current = { ...next };
    setMlPriceOverrideBySku({});
    setSaveErrors({});
  }, [rows]);

  const getDraft = useCallback((id: string) => draftsRef.current[id], []);

  const draftImpactKey = useMemo(() => makeDraftImpactKey(rows, drafts), [rows, drafts]);
  const mlOverrideKey = useMemo(() => makeMlOverrideImpactKey(mlPriceOverrideBySku), [mlPriceOverrideBySku]);
  const mlLinksKey = useMemo(() => makeMlLinksImpactKey(mlLinks), [mlLinks]);
  const filterImpactKey = useMemo(() => makePricingFilterImpactKey(q, riskFilter), [q, riskFilter]);
  const financialFp = useMemo(() => sellerFinancialSettingsFingerprint(financialSettings), [financialSettings]);

  const filteredIds = useMemo(
    () =>
      selectFilteredPricingRowIds(
        rows,
        getDraft,
        mlLinks,
        mlPriceOverrideBySku,
        mlAccountId,
        financialSettings,
        q,
        riskFilter
      ),
    [rows, getDraft, mlLinks, mlPriceOverrideBySku, mlAccountId, financialSettings, filterImpactKey, mlLinksKey, mlOverrideKey, draftImpactKey, financialFp]
  );

  const visibleRows = useMemo(() => selectVisiblePricingRows(rowsById, filteredIds), [rowsById, filteredIds]);

  const headerMetrics = useMemo(
    () => selectHeaderMetrics(rows, getDraft, mlLinks, mlPriceOverrideBySku, mlAccountId, financialSettings),
    [rows, getDraft, mlLinks, mlPriceOverrideBySku, mlAccountId, financialSettings, mlLinksKey, mlOverrideKey, draftImpactKey, financialFp]
  );

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

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const patchRowDraft = useCallback((id: string, patch: Partial<PricingDraft>) => {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next = { ...cur, ...patch };
      if (pricingDraftFieldsEqual(cur, next)) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  const saveRowById = useCallback(
    (rowId: string) => {
      const r = rowsByIdRef.current.get(rowId);
      const d = draftsRef.current[rowId];
      if (!r || !d) return;
      startTransition(() => {
        void (async () => {
          const snap = savedSnapshot.current[rowId];
          const res = await savePricingSkuInputs(rowId, mlAccountId, {
            costo: d.costo !== null && d.costo !== undefined ? d.costo : undefined,
            logistica: d.logistica,
            publicidad_pct: d.publicidad_pct,
            margen_pct: d.margen_pct
          });
          if (!res.success) {
            if (snap) {
              setDrafts((prev) => {
                const cur = prev[rowId];
                if (!cur) return prev;
                if (pricingDraftFieldsEqual(cur, snap)) return prev;
                return { ...prev, [rowId]: { ...snap } };
              });
            }
            setSaveErrors((prev) => ({ ...prev, [rowId]: res.error ?? "No se pudo guardar" }));
            invalidateDecisionCacheBySkuId(rowId);
            return;
          }
          savedSnapshot.current[rowId] = { ...d };
          setSaveErrors((prev) => ({ ...prev, [rowId]: null }));
          invalidateDecisionCacheBySkuId(rowId);
          setSavedFlashId(rowId);
          window.setTimeout(() => setSavedFlashId((cur) => (cur === rowId ? null : cur)), 1800);
        })();
      });
    },
    [mlAccountId, startTransition]
  );

  const onMlPushSuccess = useCallback((skuRowId: string, newPrice: number) => {
    setMlPriceOverrideBySku((prev) => ({ ...prev, [skuRowId]: newPrice }));
    invalidateDecisionCacheBySkuId(skuRowId);
  }, []);

  const runTransitionAsync = useCallback((fn: () => Promise<void>) => {
    startTransition(() => {
      void fn();
    });
  }, [startTransition]);

  const revertRowById = useCallback((rowId: string) => {
    const snap = savedSnapshot.current[rowId];
    if (!snap) return;
    setDrafts((prev) => {
      const cur = prev[rowId];
      if (!cur) return prev;
      if (pricingDraftFieldsEqual(cur, snap)) return prev;
      return { ...prev, [rowId]: { ...snap } };
    });
    invalidateDecisionCacheBySkuId(rowId);
  }, []);

  const onKeyDownRow = useCallback(
    (e: React.KeyboardEvent, rowId: string) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isDirtyRef.current(rowId)) saveRowById(rowId);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        revertRowById(rowId);
        setEditing(null);
      }
    },
    [revertRowById, saveRowById]
  );

  const onRequestEditField = useCallback((rowId: string, field: keyof PricingDraft) => {
    setEditing({ skuId: rowId, field });
  }, []);

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
            Margen objetivo prom.: {headerMetrics.weightedMargenObj === null ? "—" : pctLabel(headerMetrics.weightedMargenObj)}
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen real prom.: {headerMetrics.weightedReal === null ? "—" : pctLabel(headerMetrics.weightedReal)}
          </span>
          <span className="rounded-lg border border-[#E8E8E2] bg-white px-3 py-1 font-semibold text-[#1A1A1A]">
            Margen estimado prom.: {headerMetrics.weightedEstimated === null ? "—" : pctLabel(headerMetrics.weightedEstimated)}
          </span>
        </div>
      </div>

      <AccountFiscalConfigPanel
        mlAccountId={mlAccountId}
        initialSettings={financialSettings}
        onSaved={(s) => {
          invalidateDecisionCacheByAccountId(mlAccountId);
          setFinancialSettings(s);
        }}
      />

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
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-2" colSpan={1}>
                SKU / Producto
              </th>
              <th className="p-2" colSpan={1}>
                ML
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2 text-center" colSpan={2}>
                Referencia ML
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2 text-center" colSpan={4}>
                ◄ Lo que vos sabés ►
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2 text-center" colSpan={1}>
                Precio óptimo
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
              <th className="p-2" title="Publicación ML y modo de envío de la publicación">
                Publicación
              </th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Precio ML</th>
              <th className="p-2">En caja</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Costo</th>
              <th className="p-2" title="Costo logístico interno (Full / Flex / Retiro) — no es el envío de la publicación ML">
                Log. costos
              </th>
              <th className="p-2">Ads</th>
              <th className="p-2">Margen</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Precio óptimo</th>
              <th className="border-l-2 border-[#E8E8E2] p-2">Ganancia real/estimada · Margen real/estimado</th>
              <th className="p-2">ML</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const d = drafts[r.id];
              if (!d) return null;
              const mlLink = mergePricingMlLink(r.id, mlLinks, mlPriceOverrideBySku);
              const input = buildPricingRowInput(mlAccountId, r, d, mlLink, financialSettings);
              const rowKey = makeDecisionCacheKey(r.id, input);
              const dirty = isDirty(r.id);
              const editingField = editing?.skuId === r.id ? editing.field : null;
              return (
                <PricingEngineRow
                  key={r.id}
                  row={r}
                  mlLink={mlLink}
                  draftForRow={d}
                  rowKey={rowKey}
                  financialSettings={financialSettings}
                  saveStatus={savedFlashId === r.id}
                  error={saveErrors[r.id] ?? null}
                  dirty={dirty}
                  editingField={editingField}
                  mlAccountId={mlAccountId}
                  isPending={isPending}
                  patchRowDraft={patchRowDraft}
                  setEditing={setEditing}
                  onRequestEditField={onRequestEditField}
                  onKeyDownRow={onKeyDownRow}
                  runTransitionAsync={runTransitionAsync}
                  onMlPushSuccess={onMlPushSuccess}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredIds.length === 0 && rows.length > 0 ? (
        <p className="text-sm text-[#6B6B6B]">No hay filas con ese criterio.</p>
      ) : null}
    </div>
  );
}

type PricingEngineRowProps = {
  row: PricingSkuRow;
  mlLink?: MlPublicationLink;
  draftForRow: PricingDraft;
  rowKey: string;
  financialSettings: SellerFinancialSettings | null;
  saveStatus: boolean;
  error: string | null;
  dirty: boolean;
  editingField: keyof PricingDraft | null;
  mlAccountId: string;
  isPending: boolean;
  patchRowDraft: (id: string, patch: Partial<PricingDraft>) => void;
  setEditing: (v: { skuId: string; field: keyof PricingDraft } | null) => void;
  onRequestEditField: (rowId: string, field: keyof PricingDraft) => void;
  onKeyDownRow: (e: React.KeyboardEvent, rowId: string) => void;
  runTransitionAsync: (fn: () => Promise<void>) => void;
  onMlPushSuccess: (skuRowId: string, newPrice: number) => void;
};

function pricingEngineRowPropsEqual(p: Readonly<PricingEngineRowProps>, n: Readonly<PricingEngineRowProps>): boolean {
  return (
    p.rowKey === n.rowKey &&
    pricingSkuRowFieldsEqual(p.row, n.row) &&
    p.mlAccountId === n.mlAccountId &&
    pricingDraftFieldsEqual(p.draftForRow, n.draftForRow) &&
    pricingMlLinkFieldsEqual(p.mlLink, n.mlLink) &&
    p.editingField === n.editingField &&
    p.dirty === n.dirty &&
    p.saveStatus === n.saveStatus &&
    p.error === n.error &&
    p.isPending === n.isPending &&
    p.patchRowDraft === n.patchRowDraft &&
    p.setEditing === n.setEditing &&
    p.onRequestEditField === n.onRequestEditField &&
    p.onKeyDownRow === n.onKeyDownRow &&
    p.runTransitionAsync === n.runTransitionAsync &&
    p.onMlPushSuccess === n.onMlPushSuccess
  );
}

const PricingEngineRow = memo(function PricingEngineRow({
  row,
  mlLink,
  draftForRow: d,
  rowKey,
  financialSettings,
  saveStatus,
  error,
  dirty,
  editingField,
  mlAccountId,
  isPending,
  patchRowDraft,
  setEditing,
  onRequestEditField,
  onKeyDownRow,
  runTransitionAsync,
  onMlPushSuccess
}: PricingEngineRowProps) {
  const [pushOpen, setPushOpen] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);

  const decision = useMemo(() => {
    const input = buildPricingRowInput(mlAccountId, row, d, mlLink, financialSettings);
    return getCachedDecisionState(row.id, input);
  }, [rowKey, mlAccountId, row, d, mlLink, financialSettings]);

  const tier = pricingTierFromDecision(decision.decision.profitabilityStatus);
  const priceMl = decision.ml.currentPrice ?? undefined;
  const hasMlPrice = priceMl !== undefined && priceMl > 0;
  const optimal =
    decision.computed.optimalPrice !== null && Number.isFinite(decision.computed.optimalPrice)
      ? Math.round(decision.computed.optimalPrice)
      : null;
  const showPush = Boolean(
    hasMlPrice &&
      optimal !== null &&
      mlLink?.item_id &&
      mlLink.operabilityStatus !== "blocked" &&
      Math.round(priceMl as number) !== optimal
  );

  const update = (patch: Partial<PricingDraft>) => {
    patchRowDraft(row.id, patch);
  };

  const profitDisplay = toProfitDisplay(decision.computed);
  const cashInDisplay = toCashInDisplay({
    computed: decision.computed,
    currentPrice: hasMlPrice ? (priceMl as number) : null,
    freeShipping: decision.ml.freeShipping
  });
  const optimalDisplay = toOptimalPriceDisplay({
    optimalPrice: optimal,
    calculationStatus: decision.sync.calculationStatus
  });
  const canPushMl =
    showPush &&
    canTriggerMlPricePush({
      decision,
      cashInDisplay,
      operabilityStatus: mlLink?.operabilityStatus,
      optimalPrice: optimal
    });
  const ganObj = decision.computed.optimalGananciaUnit;
  const margObj = decision.inputs.targetMarginPct;

  const resultadoBlock = (() => {
    if (hasMlPrice && profitDisplay.kind !== "unavailable") {
      const amount = profitDisplay.amount;
      const margin = profitDisplay.marginPct;
      const tone = resultadoTone(amount, margin ?? 0);
      return (
        <div className={cn("space-y-0.5 tabular-nums", tone)}>
          <div className="font-semibold">
            {amount >= 0 ? "+" : ""}
            {profitDisplay.kind === "estimated" ? "≈ " : ""}
            {ars.format(amount)}
          </div>
          <div className="text-xs">
            {margin !== null ? `${(margin * 100).toFixed(1)}%` : "—"} {profitDisplay.kind === "estimated" ? "estimado" : "real"}
          </div>
          {netMarginDisplayLabel(decision.computed) ? (
            <div className="text-[10px] text-amber-900">{netMarginDisplayLabel(decision.computed)}</div>
          ) : null}
        </div>
      );
    }
    if (ganObj !== null && Number.isFinite(ganObj) && margObj !== null && optimal !== null) {
      return (
        <div className="space-y-0.5 tabular-nums text-[#6B6B6B]">
          <div className="font-semibold text-[#1A1A1A]">
            {ganObj >= 0 ? "+" : ""}
            {ars.format(ganObj)}
          </div>
          <div className="text-xs">{(margObj * 100).toFixed(1)}% obj.</div>
          <div className="text-[10px] italic text-[#6B6B6B]">(objetivo)</div>
        </div>
      );
    }
    return <span className="text-[#6B6B6B]">—</span>;
  })();

  const optimalSubtitle = optimalDisplay.kind !== "real" ? (
    <div className="text-[10px] font-normal text-amber-800">{optimalDisplay.subtitle}</div>
  ) : null;

  return (
    <tr
      tabIndex={0}
      onKeyDown={(e) => onKeyDownRow(e, row.id)}
      className={cn(
        "border-b border-[#E8E8E2] align-top outline-none",
        dirty && "bg-amber-50/60",
        !dirty && tier === "destroy" && "bg-red-50",
        !dirty && tier === "risk" && "bg-amber-50/90",
        !dirty && tier === "ok" && "bg-white",
        saveStatus && "ring-1 ring-emerald-300"
      )}
    >
      <td className="p-2 font-semibold text-[#1A1A1A]">
        <div className="flex items-start gap-2">
          <span className="font-mono text-xs text-[#6B6B6B]">{row.sku ?? "—"}</span>
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
        <div className="mt-1 max-w-[220px] text-xs font-normal leading-snug">{row.producto}</div>
        {decision.businessDecision.type !== "hold" ? (
          <p
            className={cn(
              "mt-1 text-[10px] font-semibold leading-snug",
              decision.businessDecision.priority === "critical" && "text-red-800",
              decision.businessDecision.priority === "high" && "text-amber-900",
              decision.businessDecision.priority === "medium" && "text-[#6B6B6B]",
              decision.businessDecision.priority === "low" && "text-[#6B6B6B]"
            )}
          >
            {decision.businessDecision.message}
            <span className="block font-medium text-[#6B6B6B]">{decision.businessDecision.action}</span>
          </p>
        ) : decision.decision.primaryInsight ? (
          <p className="mt-1 text-[10px] font-medium leading-snug text-[#6B6B6B]">{decision.decision.primaryInsight}</p>
        ) : null}
        {error ? <p className="mt-1 text-[10px] font-semibold text-red-700">{error}</p> : null}
        {saveStatus ? <p className="mt-1 text-[10px] font-semibold text-emerald-700">✓ Guardado</p> : null}
      </td>
      <td className="p-2 text-xs">
        {mlLink?.permalink ? (
          <div>
            <Link
              href={mlLink.permalink}
              className="font-mono font-semibold text-blue-700 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {mlLink.item_id}
            </Link>
            <div className="mt-1 text-[#6B6B6B]">
              Stock: {mlLink?.stock === null || mlLink?.stock === undefined ? "—" : mlLink.stock}
            </div>
              <div className="mt-0.5 space-y-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Envío ML</div>
              <div className="text-[10px] font-medium leading-snug text-[#1A1A1A]">
                {formatMlLogisticsPublicationLabel({
                  logistic_type: mlLink.logistic_type,
                  shipping_mode: mlLink.shipping_mode,
                  free_shipping: mlLink.free_shipping,
                  free_shipping_key_present: mlLink.free_shipping_key_present ?? undefined,
                  shipping_tags: mlLink.shipping_tags,
                  shipping_methods: mlLink.shipping_methods,
                  local_pick_up: mlLink.local_pick_up,
                  store_pick_up: mlLink.store_pick_up
                })}
              </div>
            </div>
            {decision.decision.stockStatus === "syncing" ? (
              <div className="mt-0.5 text-[10px] text-amber-800">Ventas: Sincronizando…</div>
            ) : null}
          </div>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">Sin ML</span>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-2 tabular-nums text-xs font-medium text-[#1A1A1A]">
        {hasMlPrice ? ars.format(priceMl as number) : "—"}
      </td>
      <td className="p-2 tabular-nums text-xs text-[#1A1A1A]">
        {cashInDisplay.kind === "real" ? (
          <span>{ars.format(cashInDisplay.amount)}</span>
        ) : cashInDisplay.kind === "estimated" ? (
          <span className="font-semibold text-amber-900">≈ {ars.format(cashInDisplay.amount)}</span>
        ) : (
          <span className="font-sans text-amber-900" title={cashInDisplay.reason}>
            {cashInDisplay.reason}
          </span>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-1">
        {editingField === "costo" ? (
          <input
            autoFocus
            type="number"
            className="w-full min-w-[88px] rounded border border-[#E8E8E2] px-1 py-1 text-xs tabular-nums"
            value={d.costo !== null && Number.isFinite(d.costo) ? d.costo : ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              update({ costo: raw === "" ? null : Number(raw) });
            }}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-left text-xs tabular-nums hover:bg-neutral-100"
            onClick={() => onRequestEditField(row.id, "costo")}
          >
            {d.costo !== null && Number.isFinite(d.costo) && d.costo > 0 ? ars.format(d.costo) : "—"}
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
        {editingField === "publicidad_pct" ? (
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
            onClick={() => onRequestEditField(row.id, "publicidad_pct")}
          >
            {(d.publicidad_pct * 100).toFixed(0)}%
          </button>
        )}
      </td>
      <td className="p-1">
        {editingField === "margen_pct" ? (
          <input
            autoFocus
            type="number"
            step={0.5}
            min={0}
            max={100}
            className="w-full min-w-[56px] rounded border border-[#E8E8E2] px-1 py-1 text-xs"
            value={d.margen_pct === null ? "" : Math.round(d.margen_pct * 1000) / 10}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") update({ margen_pct: null });
              else {
                const n = normalizePct(Number(raw));
                update({ margen_pct: n > 0 && n <= 1 ? n : null });
              }
            }}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded px-1 py-1 text-left text-xs tabular-nums hover:bg-neutral-100"
            onClick={() => onRequestEditField(row.id, "margen_pct")}
          >
            {d.margen_pct === null ? "—" : `${(d.margen_pct * 100).toFixed(1)}%`}
          </button>
        )}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-2 tabular-nums text-sm font-semibold text-[#1A1A1A]">
        {optimalDisplay.kind === "real"
          ? ars.format(optimalDisplay.amount)
          : optimalDisplay.kind === "estimated"
            ? `≈ ${ars.format(optimalDisplay.amount)}`
            : "—"}
        {optimalSubtitle}
      </td>
      <td className="border-l-2 border-[#E8E8E2] p-2 text-sm">{resultadoBlock}</td>
      <td className="p-2 align-top text-xs">
        {decision.businessDecision.type === "configure_cost" ? (
          <button
            type="button"
            className="font-semibold text-[#1A1A1A] underline underline-offset-2"
            onClick={() => {
              setPushOpen(false);
              setPushErr(null);
              onRequestEditField(row.id, "costo");
            }}
          >
            Configurar
          </button>
        ) : canPushMl && mlLink?.item_id && optimal !== null && priceMl !== undefined ? (
          <div className="space-y-2">
            {!pushOpen ? (
              <button
                type="button"
                disabled={isPending}
                className="rounded-lg border border-[#1A1A1A] bg-[#FFD600] px-2 py-1 font-semibold text-[#1A1A1A] disabled:opacity-50"
                onClick={() => {
                  setPushErr(null);
                  setPushOpen(true);
                }}
              >
                ↑ ML: {ars.format(priceMl)} → {ars.format(optimal)}
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-[#FAFAF8] p-2">
                <p className="font-semibold text-[#1A1A1A]">¿Actualizar precio en ML?</p>
                <p className="tabular-nums text-[#1A1A1A]">
                  {ars.format(priceMl)} → {ars.format(optimal)}
                </p>
                {pushErr ? <p className="text-[10px] font-semibold text-red-700">{pushErr}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[#1A1A1A] px-2 py-1 font-semibold text-white"
                    disabled={isPending}
                    onClick={() => {
                      runTransitionAsync(async () => {
                        const res = await pushOptimalPriceToML(mlAccountId, mlLink.item_id, optimal);
                        if (!res.success) {
                          setPushErr(res.error ?? "No se pudo actualizar el precio en ML");
                          return;
                        }
                        setPushErr(null);
                        setPushOpen(false);
                        if (res.data) onMlPushSuccess(row.id, res.data.new_price);
                      });
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E8E8E2] px-2 py-1 font-semibold"
                    onClick={() => {
                      setPushErr(null);
                      setPushOpen(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[#6B6B6B]">
            {decision.computed.profitCompleteness === "net_full" ? "—" : "Completar datos"}
          </span>
        )}
      </td>
    </tr>
  );
}, pricingEngineRowPropsEqual);
