import { getLatestCatalogSyncAt } from "@/lib/data-v2/ml-catalog-items";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { listUnifiedCatalog } from "@/lib/data-v2/unified-catalog.server";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";

export type CatalogPricingChoice = { id: string; sku: string | null; producto: string };

export async function loadCatalogPageData(mlAccountId: string): Promise<{
  items: UnifiedCatalogItem[];
  lastSyncedAt: string | null;
  pricingSkuChoices: CatalogPricingChoice[];
  loadError: string | null;
}> {
  const [unified, syncAt, pricingSkus] = await Promise.all([
    listUnifiedCatalog(mlAccountId),
    getLatestCatalogSyncAt(mlAccountId),
    listPricingSkus(mlAccountId)
  ]);

  const pricingChoices: CatalogPricingChoice[] =
    pricingSkus.success && pricingSkus.data.length > 0
      ? pricingSkus.data.map((r) => ({
          id: r.id,
          sku: r.sku,
          producto: r.producto
        }))
      : [];

  return {
    items: unified.success ? unified.data : [],
    lastSyncedAt: syncAt.success ? syncAt.data : null,
    pricingSkuChoices: pricingChoices,
    loadError: unified.success ? null : unified.error
  };
}
