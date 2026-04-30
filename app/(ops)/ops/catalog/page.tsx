import { EmptyState } from "@/components/ui/empty-state";
import { CatalogCommandCenter } from "@/components/catalog/catalog-command-center";
import { loadCatalogPageData } from "@/lib/data-v2/catalog-page-data";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsCatalogPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const mlAccountId = accountResult.data.id;
  const { items, lastSyncedAt, pricingSkuChoices, loadError, financialSettings } = await loadCatalogPageData(mlAccountId);

  return (
    <CatalogCommandCenter
      mlAccountId={mlAccountId}
      initialItems={items}
      initialFinancialSettings={financialSettings}
      lastSyncedAt={lastSyncedAt}
      pricingSkuChoices={pricingSkuChoices}
      loadError={loadError}
    />
  );
}
