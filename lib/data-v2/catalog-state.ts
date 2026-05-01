import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import { recomputeCatalogItemFinancials } from "@/lib/data-v2/unified-catalog.model";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";

export type CatalogState = {
  itemsById: Record<string, UnifiedCatalogItem>;
  orderedIds: string[];
};

export function catalogStateFromItems(items: UnifiedCatalogItem[]): CatalogState {
  const itemsById: Record<string, UnifiedCatalogItem> = {};
  const orderedIds: string[] = [];
  for (const it of items) {
    itemsById[it.item_id] = it;
    orderedIds.push(it.item_id);
  }
  return { itemsById, orderedIds };
}

/** Ordered array view — new array shell; element references are those stored in `itemsById`. */
export function catalogOrderedItems(state: CatalogState): UnifiedCatalogItem[] {
  const out: UnifiedCatalogItem[] = [];
  for (const id of state.orderedIds) {
    const row = state.itemsById[id];
    if (row) out.push(row);
  }
  return out;
}

function patchTouches(prev: UnifiedCatalogItem, patch: Partial<UnifiedCatalogItem>): boolean {
  for (const k of Object.keys(patch) as (keyof UnifiedCatalogItem)[]) {
    if (prev[k] !== patch[k]) return true;
  }
  return false;
}

export function reconcileItem(state: CatalogState, itemId: string, patch: Partial<UnifiedCatalogItem>): CatalogState {
  const prev = state.itemsById[itemId];
  if (!prev) return state;
  if (!patchTouches(prev, patch)) return state;
  const nextRow: UnifiedCatalogItem = { ...prev, ...patch };
  return {
    orderedIds: state.orderedIds,
    itemsById: { ...state.itemsById, [itemId]: nextRow }
  };
}

export function reconcileItems(state: CatalogState, patches: Record<string, Partial<UnifiedCatalogItem>>): CatalogState {
  let itemsById = state.itemsById;
  let changed = false;
  for (const [itemId, patch] of Object.entries(patches)) {
    const prev = itemsById[itemId];
    if (!prev || !patchTouches(prev, patch)) continue;
    if (!changed) {
      itemsById = { ...state.itemsById };
      changed = true;
    }
    itemsById[itemId] = { ...prev, ...patch };
  }
  if (!changed) return state;
  return { orderedIds: state.orderedIds, itemsById };
}

/** Replace one row with a server-confirmed full row (new reference). */
export function reconcileItemReplace(state: CatalogState, next: UnifiedCatalogItem): CatalogState {
  const prev = state.itemsById[next.item_id];
  if (prev === next) return state;
  return {
    orderedIds: state.orderedIds,
    itemsById: { ...state.itemsById, [next.item_id]: next }
  };
}

/** Apply multiple full-row replacements; unchanged ids keep prior references. */
export function reconcileItemReplaces(state: CatalogState, rows: UnifiedCatalogItem[]): CatalogState {
  let itemsById = state.itemsById;
  let changed = false;
  for (const next of rows) {
    const prev = itemsById[next.item_id];
    if (prev === next) continue;
    if (!changed) {
      itemsById = { ...state.itemsById };
      changed = true;
    }
    itemsById[next.item_id] = next;
  }
  if (!changed) return state;
  return { orderedIds: state.orderedIds, itemsById };
}

/** After account fiscal settings change (invalidate decision cache for `mlAccountId` first). */
export function reconcileCatalogFinancialSettings(
  mlAccountId: string,
  state: CatalogState,
  financialSettings: SellerFinancialSettings | null
): CatalogState {
  let itemsById = state.itemsById;
  let changed = false;
  for (const itemId of state.orderedIds) {
    const prev = itemsById[itemId];
    if (!prev) continue;
    const next = recomputeCatalogItemFinancials(mlAccountId, prev, financialSettings, undefined);
    if (!changed) {
      itemsById = { ...state.itemsById };
      changed = true;
    }
    itemsById[itemId] = next;
  }
  if (!changed) return state;
  return { orderedIds: state.orderedIds, itemsById };
}

/** Explicit dataset-level replace (sync / initial navigation only). */
export function replaceCatalogState(next: CatalogState): CatalogState {
  return next;
}
