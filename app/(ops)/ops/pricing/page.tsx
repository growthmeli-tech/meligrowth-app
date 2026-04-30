import Link from "next/link";
import { PricingEngineTable } from "@/components/pricing/pricing-engine-table";
import { EmptyState } from "@/components/ui/empty-state";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { mapPricingSkusToMlLinks, type MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import { listUnifiedCatalog } from "@/lib/data-v2/unified-catalog.server";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
export default async function OpsPricingPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const skusResult = await listPricingSkus(accountResult.data.id);
  if (!skusResult.success) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No pudimos cargar el catálogo de precios.
      </div>
    );
  }

  const unified = await listUnifiedCatalog(accountResult.data.id);
  const mlLinksRecord: Record<string, MlPublicationLink> = unified.success
    ? Object.fromEntries(mapPricingSkusToMlLinks(skusResult.data, unified.data))
    : {};

  const rows = skusResult.data;

  if (rows.length === 0) {
    return (
      <main className="space-y-4">
        <header>
          <h1 className="text-xl font-black text-[#1A1A1A]">Motor de precios</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">SKU-level desde planilla de márgenes.</p>
        </header>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#1A1A1A]">
            Aún no cargaste tu catálogo de precios. Subí la Planilla 2 desde Archivos.
          </p>
          <Link
            href="/ops/files"
            className="mt-4 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]"
          >
            Ir a Archivos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <PricingEngineTable rows={rows} mlLinks={mlLinksRecord} mlAccountId={accountResult.data.id} />
    </main>
  );
}
