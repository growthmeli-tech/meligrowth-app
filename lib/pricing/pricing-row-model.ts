import type { Database } from "@/lib/supabase/database.types";
import type { MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import type { BuildSkuDecisionStateInput } from "@/lib/pricing/sku-decision-state";
import { normalizePct, type LogisticaType } from "@/lib/pricing/calculator";

export type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

export type PricingDraft = {
  costo: number;
  logistica: LogisticaType;
  publicidad_pct: number;
  margen_pct: number | null;
};

export function rowToDraft(r: PricingSkuRow): PricingDraft {
  const margRaw = r.margen_pct === null || r.margen_pct === undefined ? null : normalizePct(Number(r.margen_pct));
  const margen_pct = margRaw === null || !Number.isFinite(margRaw) || margRaw <= 0 ? null : margRaw;
  return {
    costo: Number(r.costo),
    logistica: r.logistica as LogisticaType,
    publicidad_pct:
      r.publicidad_pct === null || r.publicidad_pct === undefined ? 0 : normalizePct(Number(r.publicidad_pct)),
    margen_pct
  };
}

export function buildPricingRowInput(
  mlAccountId: string,
  r: PricingSkuRow,
  d: PricingDraft,
  ml?: MlPublicationLink
): BuildSkuDecisionStateInput {
  return {
    accountId: mlAccountId,
    ml: {
      itemId: ml?.item_id ?? null,
      sku: r.sku,
      title: r.producto,
      imageUrl: ml?.thumbnail ?? null,
      currentPrice: ml?.price_ml ?? null,
      stock: ml?.stock ?? null,
      ventas30d: ml?.ventas_30d ?? null,
      revenue30d: ml?.revenue_30d ?? null,
      lastSaleDate: ml?.last_sale_date ?? null,
      shippingMode: ml?.logistic_type ?? null,
      listingType: null,
      freeShipping: null,
      categoryId: null
    },
    inputs: {
      productCost: Number.isFinite(d.costo) ? d.costo : null,
      logistics: d.logistica,
      publicidadPct: d.publicidad_pct,
      targetMarginPct: d.margen_pct,
      pesoKg: r.peso_kg !== null && r.peso_kg !== undefined ? Number(r.peso_kg) : null,
      reputacion: r.reputacion
    }
  };
}

export function mergePricingMlLink(
  rowId: string,
  mlLinks: Record<string, MlPublicationLink> | undefined,
  overridePriceBySkuId: Record<string, number>
): MlPublicationLink | undefined {
  const base = mlLinks?.[rowId];
  const o = overridePriceBySkuId[rowId];
  if (base && o !== undefined) return { ...base, price_ml: o };
  return base;
}

export function pricingSkuRowFieldsEqual(a: PricingSkuRow, b: PricingSkuRow): boolean {
  return (
    a.id === b.id &&
    a.sku === b.sku &&
    a.producto === b.producto &&
    a.reputacion === b.reputacion &&
    a.peso_kg === b.peso_kg
  );
}

export function pricingDraftFieldsEqual(a: PricingDraft, b: PricingDraft): boolean {
  return (
    a.costo === b.costo &&
    a.logistica === b.logistica &&
    a.publicidad_pct === b.publicidad_pct &&
    a.margen_pct === b.margen_pct
  );
}

export function pricingMlLinkFieldsEqual(a: MlPublicationLink | undefined, b: MlPublicationLink | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.item_id === b.item_id &&
    a.price_ml === b.price_ml &&
    a.stock === b.stock &&
    a.ventas_30d === b.ventas_30d &&
    a.revenue_30d === b.revenue_30d &&
    a.last_sale_date === b.last_sale_date &&
    a.logistic_type === b.logistic_type &&
    a.thumbnail === b.thumbnail &&
    a.permalink === b.permalink
  );
}

function fnv1aU32(h: number, byte: number): number {
  return Math.imul((h ^ byte) >>> 0, 16777619) >>> 0;
}

function fnv1aStr(h: number, s: string): number {
  let x = h >>> 0;
  for (let i = 0; i < s.length; i += 1) x = fnv1aU32(x, s.charCodeAt(i));
  return x >>> 0;
}

/** Compact fingerprint for selector deps — avoids `useMemo(..., [drafts])` identity churn. */
export function makeDraftImpactKey(rows: readonly { id: string }[], drafts: Record<string, PricingDraft | undefined>): string {
  let h = 2166136261 >>> 0;
  for (const r of rows) {
    const d = drafts[r.id];
    if (!d) continue;
    h = fnv1aStr(h, r.id);
    const m = d.margen_pct === null || !Number.isFinite(d.margen_pct) ? -999 : d.margen_pct;
    h = fnv1aU32(h, (d.costo * 131) | 0);
    h = fnv1aStr(h, d.logistica);
    h = fnv1aU32(h, (d.publicidad_pct * 7919) | 0);
    h = fnv1aU32(h, (m * 7937) | 0);
  }
  return h.toString(16);
}

export function makeMlOverrideImpactKey(overrides: Record<string, number>): string {
  const keys = Object.keys(overrides).sort();
  let h = 2166136261 >>> 0;
  for (const k of keys) {
    const v = overrides[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    h = fnv1aStr(h, k);
    h = fnv1aU32(h, (v * 100) | 0);
  }
  return `${keys.length}:${h.toString(16)}`;
}

/** Fields that feed `mergePricingMlLink` + decision inputs from ML side. */
export function makeMlLinksImpactKey(mlLinks: Record<string, MlPublicationLink> | undefined): string {
  if (!mlLinks) return "0";
  const keys = Object.keys(mlLinks).sort();
  let h = 2166136261 >>> 0;
  for (const k of keys) {
    const m = mlLinks[k];
    if (!m) continue;
    h = fnv1aStr(h, k);
    h = fnv1aStr(h, m.item_id ?? "");
    h = fnv1aU32(h, m.price_ml === null || m.price_ml === undefined ? 0 : (m.price_ml * 103) | 0);
    h = fnv1aU32(h, m.stock ?? 0);
    h = fnv1aU32(h, m.ventas_30d === null || m.ventas_30d === undefined ? 0 : (m.ventas_30d * 17) | 0);
    h = fnv1aStr(h, m.logistic_type ?? "");
  }
  return `${keys.length}:${h.toString(16)}`;
}

export function makePricingFilterImpactKey(q: string, riskFilter: "all" | "destroy" | "risk"): string {
  return `${riskFilter}\x1f${q}`;
}
