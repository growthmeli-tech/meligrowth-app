import { getLatestCatalogSyncAt } from "@/lib/data-v2/ml-catalog-items";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { listUnifiedCatalog } from "@/lib/data-v2/unified-catalog.server";
import { getFinancialSettingsForAccount } from "@/lib/data-v2/financial-settings.server";
import type { UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";

export type CatalogPricingChoice = { id: string; sku: string | null; producto: string };

export async function loadCatalogPageData(mlAccountId: string): Promise<{
  items: UnifiedCatalogItem[];
  lastSyncedAt: string | null;
  pricingSkuChoices: CatalogPricingChoice[];
  loadError: string | null;
  financialSettings: SellerFinancialSettings | null;
}> {
  const [unified, syncAt, pricingSkus, financialSettings] = await Promise.all([
    listUnifiedCatalog(mlAccountId),
    getLatestCatalogSyncAt(mlAccountId),
    listPricingSkus(mlAccountId),
    getFinancialSettingsForAccount(mlAccountId)
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
    loadError: unified.success ? null : unified.error,
    financialSettings
  };
}
