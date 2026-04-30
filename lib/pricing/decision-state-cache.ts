import { normalizePct, type SellerFinancialSettings } from "@/lib/pricing/calculator";
import { buildSkuDecisionState, type BuildSkuDecisionStateInput, type SkuDecisionState } from "@/lib/pricing/sku-decision-state";

const SEP = "\x1f";

/** Fixed-point numeric token for collision-safe keys. */
function keyNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Math.round(v * 1_000_000) / 1_000_000);
}

function financialSettingsKey(fs: SellerFinancialSettings | null | undefined): string {
  if (!fs) return "";
  return [
    keyNum(fs.iibbPct ?? undefined),
    keyNum(fs.taxPct ?? undefined),
    keyNum(fs.internalLogisticsCost ?? undefined),
    keyNum(fs.fixedUnitCost ?? undefined),
    keyNum(fs.additionalCostsPct ?? undefined),
    keyNum(fs.additionalCostsFixed ?? undefined)
  ].join("\x1e");
}

/**
 * Deterministic, minimal key. Partition: first segment `skuId` (opaque row id).
 * Value segments: currentPrice, stock, ventas30d, productCost, publicidadPct,
 * targetMarginPct, logistics, taxPct, additionalCosts (per product contract).
 */
export function makeDecisionCacheKey(skuId: string, input: BuildSkuDecisionStateInput): string {
  const ml = input.ml;
  const i = input.inputs;
  const pubKey = keyNum(normalizePct(i.publicidadPct ?? 0));
  const target =
    i.targetMarginPct === null || i.targetMarginPct === undefined ? "" : keyNum(normalizePct(i.targetMarginPct));
  return [
    skuId,
    keyNum(ml.currentPrice),
    keyNum(ml.stock),
    keyNum(ml.ventas30d),
    keyNum(i.productCost),
    pubKey,
    target,
    String(i.logistics ?? ""),
    i.taxPct === null || i.taxPct === undefined ? "" : keyNum(i.taxPct),
    i.iibbPct === null || i.iibbPct === undefined ? "" : keyNum(i.iibbPct),
    i.additionalCosts === null || i.additionalCosts === undefined ? "" : keyNum(i.additionalCosts),
    financialSettingsKey(input.financialSettings)
  ].join(SEP);
}

export class DecisionStateCache {
  private readonly map = new Map<string, SkuDecisionState>();
  readonly maxSize = 10_000;

  get(key: string): SkuDecisionState | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, state: SkuDecisionState): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, state);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  deleteKey(key: string): void {
    this.map.delete(key);
  }

  /** O(n_keys) — only keys whose first segment equals skuId. */
  invalidateBySku(skuId: string): void {
    const prefix = `${skuId}${SEP}`;
    for (const k of [...this.map.keys()]) {
      if (k === skuId || k.startsWith(prefix)) {
        this.map.delete(k);
      }
    }
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

let singleton: DecisionStateCache | null = null;

export function getDecisionStateCache(): DecisionStateCache {
  if (!singleton) singleton = new DecisionStateCache();
  return singleton;
}

/** Test-only reset (no global invalidation in prod). */
export function resetDecisionStateCacheForTests(): void {
  singleton = null;
}

/**
 * Execution layer: LRU cache + pure `buildSkuDecisionState`.
 * Never call `buildSkuDecisionState` directly from UI for hot paths.
 */
export function getCachedDecisionState(skuId: string, input: BuildSkuDecisionStateInput): SkuDecisionState {
  const cache = getDecisionStateCache();
  const key = makeDecisionCacheKey(skuId, input);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const built = buildSkuDecisionState(input);
  cache.set(key, built);
  return built;
}

export function invalidateDecisionCacheBySkuId(skuId: string): void {
  getDecisionStateCache().invalidateBySku(skuId);
}
