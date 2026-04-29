"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { cn } from "@/lib/utils";
import {
  bulkMarkNoAds,
  exportMasterCatalog,
  linkSkuToItem,
  saveCostForItem,
  triggerCatalogSync
} from "@/app/(ops)/ops/catalog/actions";

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

export function CatalogCommandCenter({ mlAccountId, initialItems, lastSyncedAt, pricingSkuChoices, loadError }: Props) {
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
  const [pillPreset, setPillPreset] = useState<string | null>(null);

  const [costForms, setCostForms] = useState<Record<string, { costo: string; logistica: string; margen: string; pub: string }>>({});

  const stale = useMemo(() => {
    if (!lastSyncedAt) return true;
    return Date.now() - new Date(lastSyncedAt).getTime() > 6 * 60 * 60 * 1000;
  }, [lastSyncedAt]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((row) => {
      if (pillPreset === "sin_stock") {
        if (row.stock !== 0) return false;
      } else if (pillPreset === "sin_costo") {
        if (row.tiene_costo) return false;
      } else if (pillPreset === "precio_desviado") {
        if (!row.precio_desviado) return false;
      } else if (pillPreset === "ok") {
        if (!row.tiene_costo || row.precio_desviado || row.stock_critico || row.margen_en_riesgo) return false;
      }

      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (logFilter !== "all" && (row.logistic_type ?? "") !== logFilter) return false;
      if (costFilter === "sin" && row.tiene_costo) return false;
      if (costFilter === "con" && !row.tiene_costo) return false;

      if (margenFilter === "riesgo" && !row.margen_en_riesgo) return false;
      if (margenFilter === "ok" && row.margen_en_riesgo) return false;

      if (qq) {
        const blob = `${row.item_id} ${row.title} ${row.seller_custom_field ?? ""} ${row.sku ?? ""}`.toLowerCase();
        if (!blob.includes(qq)) return false;
      }
      return true;
    });
  }, [items, q, statusFilter, logFilter, margenFilter, costFilter, pillPreset]);

  const counts = useMemo(() => {
    const sinStock = items.filter((i) => i.status === "active" && i.stock === 0).length;
    const sinCosto = items.filter((i) => !i.tiene_costo).length;
    const precioDesviado = items.filter((i) => i.precio_desviado).length;
    const bien = items.filter((i) => i.tiene_costo && !i.precio_desviado && !i.stock_critico && !i.margen_en_riesgo).length;
    return { sinStock, sinCosto, precioDesviado, bien };
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

  const applyPill = (key: string | null) => {
    setPillPreset(key);
    setCostFilter("all");
    setMargenFilter("all");
    if (key === "sin_stock") setStatusFilter("active");
  };

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-black text-[#1A1A1A]">CATÁLOGO</h1>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              {items.length} publicaciones · Sync: {formatSyncLabel(lastSyncedAt)}
              {stale ? (
                <span className="ml-2 font-semibold text-amber-800">· Datos desactualizados · Sincronizá</span>
              ) : null}
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

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E8E8E2] pt-4">
          <input
            type="search"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[160px] flex-1 rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#E8E8E2] px-2 py-2 text-sm font-semibold"
          >
            <option value="all">Estado (todos)</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="closed">closed</option>
          </select>
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="rounded-lg border border-[#E8E8E2] px-2 py-2 text-sm font-semibold"
          >
            <option value="all">Logística (todas)</option>
            <option value="fulfillment">fulfillment</option>
            <option value="xd_drop_off">xd_drop_off</option>
            <option value="cross_docking">cross_docking</option>
            <option value="self_service">self_service</option>
          </select>
          <select
            value={margenFilter}
            onChange={(e) => setMargenFilter(e.target.value)}
            className="rounded-lg border border-[#E8E8E2] px-2 py-2 text-sm font-semibold"
          >
            <option value="all">Margen (todos)</option>
            <option value="riesgo">&lt;10% en riesgo</option>
            <option value="ok">≥10%</option>
          </select>
          <select
            value={costFilter}
            onChange={(e) => setCostFilter(e.target.value)}
            className="rounded-lg border border-[#E8E8E2] px-2 py-2 text-sm font-semibold"
          >
            <option value="all">Costo (todos)</option>
            <option value="sin">Sin costo</option>
            <option value="con">Con costo</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => applyPill("sin_stock")}
            className={cn(
              "rounded-full px-3 py-1",
              pillPreset === "sin_stock" ? "bg-red-600 text-white" : "bg-red-50 text-red-900 border border-red-200"
            )}
          >
            {counts.sinStock} sin stock
          </button>
          <button
            type="button"
            onClick={() => applyPill("sin_costo")}
            className={cn(
              "rounded-full px-3 py-1",
              pillPreset === "sin_costo" ? "bg-amber-400 text-[#1A1A1A]" : "bg-amber-50 text-amber-950 border border-amber-200"
            )}
          >
            {counts.sinCosto} sin costo
          </button>
          <button
            type="button"
            onClick={() => applyPill("precio_desviado")}
            className={cn(
              "rounded-full px-3 py-1",
              pillPreset === "precio_desviado" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-950 border border-orange-200"
            )}
          >
            {counts.precioDesviado} precio desviado
          </button>
          <button
            type="button"
            onClick={() => applyPill("ok")}
            className={cn(
              "rounded-full px-3 py-1",
              pillPreset === "ok" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-900 border border-emerald-200"
            )}
          >
            {counts.bien} bien configurados
          </button>
          {pillPreset ? (
            <button type="button" onClick={() => applyPill(null)} className="rounded-full border border-[#E8E8E2] px-3 py-1 text-[#6B6B6B]">
              Limpiar filtros rápidos
            </button>
          ) : null}
        </div>

        {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}
        {syncHint ? <p className="mt-3 text-sm text-red-700">{syncHint}</p> : null}
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
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
              <th className="p-2 w-8">
                <input type="checkbox" aria-label="Seleccionar todas" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAllFiltered} />
              </th>
              <th className="p-2">Imagen</th>
              <th className="p-2">Título / SKU</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Precio ML</th>
              <th className="p-2">Costo</th>
              <th className="p-2">Precio calc</th>
              <th className="p-2">Margen</th>
              <th className="p-2">Ganancia</th>
              <th className="p-2">Estado</th>
              <th className="p-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center">
                  <p className="font-medium text-[#1A1A1A]">No hay publicaciones sincronizadas.</p>
                  <button type="button" disabled={pending} onClick={onSync} className="mt-4 rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold">
                    Sincronizar con Mercado Libre
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const tone = !row.tiene_costo
                  ? "bg-neutral-50"
                  : row.stock === 0
                    ? "bg-red-50"
                    : row.margen_en_riesgo
                      ? "bg-amber-50"
                      : row.precio_desviado
                        ? "bg-orange-50"
                        : "";
                const open = expanded === row.item_id;
                return (
                  <FragmentRow
                    key={row.item_id}
                    row={row}
                    tone={tone}
                    open={open}
                    pending={pending}
                    selected={selected.has(row.item_id)}
                    onToggle={() => toggleSelect(row.item_id)}
                    onToggleExpand={() => setExpanded(open ? null : row.item_id)}
                    mlAccountId={mlAccountId}
                    pricingSkuChoices={pricingSkuChoices}
                    costForms={costForms}
                    setCostForms={setCostForms}
                    onSaved={() => router.refresh()}
                    startTransition={startTransition}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  tone,
  open,
  pending,
  selected,
  onToggle,
  onToggleExpand,
  mlAccountId,
  pricingSkuChoices,
  costForms,
  setCostForms,
  onSaved,
  startTransition
}: {
  row: UnifiedCatalogItem;
  tone: string;
  open: boolean;
  pending: boolean;
  selected: boolean;
  onToggle: () => void;
  onToggleExpand: () => void;
  mlAccountId: string;
  pricingSkuChoices: PricingChoice[];
  costForms: Record<string, { costo: string; logistica: string; margen: string; pub: string }>;
  setCostForms: Dispatch<SetStateAction<Record<string, { costo: string; logistica: string; margen: string; pub: string }>>>;
  onSaved: () => void;
  startTransition: (cb: () => Promise<void>) => void;
}) {
  const [linkId, setLinkId] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const margenLabel =
    row.margen_pct === null || row.margen_pct === undefined ? "—" : `${(Number(row.margen_pct) * 100).toFixed(1)}%`;

  return (
    <>
      <tr className={cn("border-b border-[#E8E8E2] align-top", tone)}>
        <td className="p-2">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Seleccionar ${row.item_id}`} />
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
          <div className="font-semibold text-[#1A1A1A]">{row.title}</div>
          <div className="mt-1 font-mono text-xs text-[#6B6B6B]">{row.item_id}</div>
          {row.sku ? <div className="text-xs text-[#6B6B6B]">SKU costos: {row.sku}</div> : null}
          {!row.tiene_costo ? (
            <span className="mt-2 inline-block rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800">Sin costo</span>
          ) : null}
        </td>
        <td className="p-2">
          <span className={cn(row.stock_critico && "rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white")}>
            {row.stock === null ? "—" : row.stock}
          </span>
        </td>
        <td className="p-2 tabular-nums">{row.price_ml === null ? "—" : ars.format(row.price_ml)}</td>
        <td className="p-2 tabular-nums">{row.costo === null ? "—" : ars.format(row.costo)}</td>
        <td className="p-2 tabular-nums">
          {row.precio_calculado === null ? "—" : ars.format(row.precio_calculado)}
          {row.precio_desviado && row.price_ml !== null && row.precio_calculado !== null ? (
            <div className="text-xs font-semibold text-orange-800">
              ML {ars.format(row.price_ml)} vs calc {ars.format(row.precio_calculado)}
            </div>
          ) : null}
        </td>
        <td className="p-2">{margenLabel}</td>
        <td className="p-2 tabular-nums">{row.ganancia_calculada === null ? "—" : ars.format(row.ganancia_calculada)}</td>
        <td className="p-2 text-xs font-semibold uppercase">{row.status}</td>
        <td className="p-2">
          <button type="button" onClick={onToggleExpand} className="grid place-items-center rounded border border-[#E8E8E2] p-1">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className={cn("border-b border-[#E8E8E2] bg-[#FAFAF8]", tone)}>
          <td colSpan={11} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                {row.permalink ? (
                  <p>
                    <span className="font-semibold">Permalink: </span>
                    <Link href={row.permalink} className="font-semibold text-blue-700 underline" target="_blank" rel="noreferrer">
                      Abrir en ML
                    </Link>
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold">Logística ML:</span> {row.logistic_type ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Vendidos:</span> {row.sold_quantity === null ? "—" : row.sold_quantity}
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-[#E8E8E2] bg-white p-3">
                {!row.tiene_costo ? (
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">Configurar costo</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#6B6B6B]">
                        Costo
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
                                margen: prev[row.item_id]?.margen ?? "0.15",
                                pub: prev[row.item_id]?.pub ?? "0.1"
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
                                margen: prev[row.item_id]?.margen ?? "0.15",
                                pub: prev[row.item_id]?.pub ?? "0.1"
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
                        % Margen (0–1)
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                          value={costForms[row.item_id]?.margen ?? "0.15"}
                          onChange={(e) =>
                            setCostForms((prev) => ({
                              ...prev,
                              [row.item_id]: {
                                costo: prev[row.item_id]?.costo ?? "",
                                logistica: prev[row.item_id]?.logistica ?? "Flex",
                                margen: e.target.value,
                                pub: prev[row.item_id]?.pub ?? "0.1"
                              }
                            }))
                          }
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#6B6B6B]">
                        % Publicidad (0–1)
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded border border-[#E8E8E2] px-2 py-1 text-sm"
                          value={costForms[row.item_id]?.pub ?? "0.1"}
                          onChange={(e) =>
                            setCostForms((prev) => ({
                              ...prev,
                              [row.item_id]: {
                                costo: prev[row.item_id]?.costo ?? "",
                                logistica: prev[row.item_id]?.logistica ?? "Flex",
                                margen: prev[row.item_id]?.margen ?? "0.15",
                                pub: e.target.value
                              }
                            }))
                          }
                        />
                      </label>
                    </div>
                    {hint ? <p className="text-xs text-red-700">{hint}</p> : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="mt-3 rounded-lg bg-[#FFD600] px-3 py-2 text-sm font-semibold"
                      onClick={() => {
                        const f = costForms[row.item_id];
                        const costo = Number(f?.costo);
                        if (!Number.isFinite(costo) || costo <= 0) {
                          setHint("Ingresá un costo válido.");
                          return;
                        }
                        const logistica = (f?.logistica ?? "Flex") as "Full" | "Flex" | "Retiro domicilio";
                        const margen = Number(f?.margen ?? 0.15);
                        const pub = Number(f?.pub ?? 0);
                        setHint(null);
                        startTransition(async () => {
                          const res = await saveCostForItem(mlAccountId, row.item_id, {
                            costo,
                            logistica,
                            margen_pct: margen,
                            publicidad_pct: pub
                          });
                          if (!res.success) {
                            setHint(res.error ?? "No se pudo guardar");
                            return;
                          }
                          onSaved();
                        });
                      }}
                    >
                      Guardar costo y vincular
                    </button>
                  </div>
                ) : (
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
                    {hint ? <p className="text-xs text-red-700">{hint}</p> : null}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
