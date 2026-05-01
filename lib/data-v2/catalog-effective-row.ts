import type { CatalogState } from "@/lib/data-v2/catalog-state";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog.types";
import {
  recomputeCatalogItemFinancials,
  type LocalShippingPolicyOverride
} from "@/lib/data-v2/unified-catalog.model";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";

/** Session-only map: item_id → política de envío gratis simulada (no persiste, no muta ML). */
export type LocalShippingPolicyOverrides = Record<string, LocalShippingPolicyOverride>;

export type CatalogEffectiveContext = {
  mlAccountId: string;
  financialSettings: SellerFinancialSettings | null;
  localShippingPolicyOverrides: LocalShippingPolicyOverrides;
};

/**
 * Única entrada para fila efectiva del catálogo (override local + datos ML en `row`).
 * Sin override para ese `item_id` → misma referencia `row` (sin recomputar).
 */
export function getEffectiveCatalogItem(
  mlAccountId: string,
  row: UnifiedCatalogItem,
  localShippingPolicyOverrides: LocalShippingPolicyOverrides | undefined,
  financialSettings: SellerFinancialSettings | null
): UnifiedCatalogItem {
  if (!localShippingPolicyOverrides || !Object.prototype.hasOwnProperty.call(localShippingPolicyOverrides, row.item_id)) {
    return row;
  }
  const pol = localShippingPolicyOverrides[row.item_id];
  if (pol === undefined) return row;
  return recomputeCatalogItemFinancials(mlAccountId, row, financialSettings, null, pol);
}

export function localShippingPolicyOverridesFingerprint(o: LocalShippingPolicyOverrides): string {
  const keys = Object.keys(o).sort();
  if (!keys.length) return "";
  return keys.map((k) => `${k}\x1e${String(o[k]?.overrideFreeShipping)}`).join("\x1f");
}

/** Orden del catálogo con política local aplicada (insights, métricas agregadas). */
export function catalogOrderedEffectiveItems(state: CatalogState, ctx: CatalogEffectiveContext): UnifiedCatalogItem[] {
  const out: UnifiedCatalogItem[] = [];
  for (const id of state.orderedIds) {
    const base = state.itemsById[id];
    if (base) {
      out.push(
        getEffectiveCatalogItem(ctx.mlAccountId, base, ctx.localShippingPolicyOverrides, ctx.financialSettings)
      );
    }
  }
  return out;
}
