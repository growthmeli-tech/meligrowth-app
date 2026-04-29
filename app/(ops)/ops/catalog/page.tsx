import { EmptyState } from "@/components/ui/empty-state";
import { CatalogCommandCenter } from "@/components/catalog/catalog-command-center";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { listUnifiedCatalog } from "@/lib/data-v2/unified-catalog";
import { getLatestCatalogSyncAt } from "@/lib/data-v2/ml-catalog-items";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsCatalogPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const mlAccountId = accountResult.data.id;

  const [unified, syncAt, pricingSkus] = await Promise.all([
    listUnifiedCatalog(mlAccountId),
    getLatestCatalogSyncAt(mlAccountId),
    listPricingSkus(mlAccountId)
  ]);

  const pricingChoices =
    pricingSkus.success && pricingSkus.data.length > 0
      ? pricingSkus.data.map((r) => ({
          id: r.id,
          sku: r.sku,
          producto: r.producto
        }))
      : [];

  return (
    <CatalogCommandCenter
      mlAccountId={mlAccountId}
      initialItems={unified.success ? unified.data : []}
      lastSyncedAt={syncAt.success ? syncAt.data : null}
      pricingSkuChoices={pricingChoices}
      loadError={unified.success ? null : unified.error}
    />
  );
}
