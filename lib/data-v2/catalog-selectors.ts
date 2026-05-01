import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import type { CatalogState } from "@/lib/data-v2/catalog-state";
import {
  getEffectiveCatalogItem,
  type CatalogEffectiveContext
} from "@/lib/data-v2/catalog-effective-row";

export type CatalogFilterState = {
  q: string;
  statusFilter: string;
  logFilter: string;
  margenFilter: string;
  costFilter: string;
  stockFilter: string;
  activePill: "critico" | "reponer" | "riesgo" | "ok" | null;
};

function resolveEffectiveRow(
  state: CatalogState,
  id: string,
  ctx: CatalogEffectiveContext | undefined
): UnifiedCatalogItem | undefined {
  const base = state.itemsById[id];
  if (!base) return undefined;
  if (!ctx) return base;
  return getEffectiveCatalogItem(
    ctx.mlAccountId,
    base,
    ctx.localShippingPolicyOverrides,
    ctx.financialSettings
  );
}

function isCriticoRow(row: UnifiedCatalogItem): boolean {
  return (
    row.decisionState.decision.stockStatus === "critical" ||
    row.stock_status === "critico" ||
    (row.status === "active" && row.stock === 0)
  );
}

export function makeCatalogFilterImpactKey(f: CatalogFilterState, localShippingFingerprint = ""): string {
  return [
    f.q,
    f.statusFilter,
    f.logFilter,
    f.margenFilter,
    f.costFilter,
    f.stockFilter,
    f.activePill ?? "",
    localShippingFingerprint
  ].join("\x1f");
}

export function selectCatalogFilteredIds(
  state: CatalogState,
  f: CatalogFilterState,
  ctx?: CatalogEffectiveContext
): string[] {
  const qq = f.q.trim().toLowerCase();
  const out: string[] = [];
  for (const id of state.orderedIds) {
    const row = resolveEffectiveRow(state, id, ctx);
    if (!row) continue;

    if (f.activePill === "critico") {
      if (!isCriticoRow(row)) continue;
    } else if (f.activePill === "reponer") {
      if (row.stock_status !== "reponer") continue;
    } else if (f.activePill === "riesgo") {
      if (
        !(
          row.tiene_costo &&
          row.price_ml !== null &&
          ["risk", "low_margin"].includes(row.decisionState.decision.profitabilityStatus)
        )
      ) {
        continue;
      }
    } else if (f.activePill === "ok") {
      if (
        !row.tiene_costo ||
        isCriticoRow(row) ||
        row.decisionState.decision.profitabilityStatus === "loss" ||
        ["risk", "low_margin"].includes(row.decisionState.decision.profitabilityStatus)
      ) {
        continue;
      }
    }

    if (f.statusFilter !== "all" && row.status !== f.statusFilter) continue;
    if (f.logFilter !== "all" && (row.logistic_type ?? "") !== f.logFilter) continue;
    if (f.costFilter === "sin" && row.tiene_costo) continue;
    if (f.costFilter === "con" && !row.tiene_costo) continue;
    if (f.stockFilter !== "all" && (row.stock_status ?? "") !== f.stockFilter) continue;

    if (f.margenFilter === "pierde" && row.decisionState.decision.profitabilityStatus !== "loss") continue;
    if (f.margenFilter === "riesgo" && !["risk", "low_margin"].includes(row.decisionState.decision.profitabilityStatus)) {
      continue;
    }
    if (f.margenFilter === "ok") {
      const st = row.decisionState.decision.profitabilityStatus;
      if (st === "loss" || st === "risk" || st === "low_margin") continue;
    }

    if (qq) {
      const blob = `${row.item_id} ${row.title} ${row.seller_custom_field ?? ""} ${row.sku ?? ""}`.toLowerCase();
      if (!blob.includes(qq)) continue;
    }
    out.push(id);
  }
  return out;
}

export function selectCatalogVisibleRows(
  state: CatalogState,
  filteredIds: string[],
  ctx?: CatalogEffectiveContext
): UnifiedCatalogItem[] {
  const out: UnifiedCatalogItem[] = [];
  for (const id of filteredIds) {
    const r = resolveEffectiveRow(state, id, ctx);
    if (r) out.push(r);
  }
  return out;
}

export function selectCatalogCounts(state: CatalogState, ctx?: CatalogEffectiveContext): {
  critico: number;
  reponer: number;
  margenRiesgo: number;
  ok: number;
} {
  let critico = 0;
  let reponer = 0;
  let margenRiesgo = 0;
  let ok = 0;
  for (const id of state.orderedIds) {
    const i = resolveEffectiveRow(state, id, ctx);
    if (!i) continue;
    if (isCriticoRow(i)) critico += 1;
    if (i.stock_status === "reponer") reponer += 1;
    if (
      i.tiene_costo &&
      i.price_ml !== null &&
      ["risk", "low_margin"].includes(i.decisionState.decision.profitabilityStatus)
    ) {
      margenRiesgo += 1;
    }
    if (
      i.tiene_costo &&
      !isCriticoRow(i) &&
      !["loss", "risk", "low_margin"].includes(i.decisionState.decision.profitabilityStatus)
    ) {
      ok += 1;
    }
  }
  return { critico, reponer, margenRiesgo, ok };
}

export function selectCatalogPromMargenReal(state: CatalogState, ctx?: CatalogEffectiveContext): number | null {
  let w = 0;
  let acc = 0;
  for (const id of state.orderedIds) {
    const row = resolveEffectiveRow(state, id, ctx);
    if (!row) continue;
    if (!row.tiene_costo || row.margen_real_pct === null || row.costo === null || row.costo <= 0) continue;
    w += row.costo;
    acc += row.margen_real_pct * row.costo;
  }
  if (w <= 0) return null;
  return acc / w;
}
