import { CatalogCommandCenter } from "@/components/catalog/catalog-command-center";
import { loadCatalogPageData } from "@/lib/data-v2/catalog-page-data";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";

export default async function InternalClientCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;

  const accountsResult = await listMlAccountsByCompany(companyId, { activeOnly: true });
  let account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!account) {
    const fallback = await listMlAccountsByCompany(companyId);
    account = fallback.success ? (fallback.data[0] ?? null) : null;
  }

  if (!account) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
          No hay cuenta ML para cargar el catálogo. Configurá ML primero.
        </div>
      </main>
    );
  }

  const mlAccountId = account.id;
  const { items, lastSyncedAt, pricingSkuChoices, loadError, financialSettings } = await loadCatalogPageData(mlAccountId);

  return (
    <main className="p-4 md:p-6">
      <CatalogCommandCenter
        mlAccountId={mlAccountId}
        initialItems={items}
        initialFinancialSettings={financialSettings}
        lastSyncedAt={lastSyncedAt}
        pricingSkuChoices={pricingSkuChoices}
        loadError={loadError}
      />
    </main>
  );
}
