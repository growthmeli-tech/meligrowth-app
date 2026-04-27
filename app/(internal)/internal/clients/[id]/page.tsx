import Link from "next/link";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { ScoreDisplay } from "@/components/score/score-display";
import { EmptyState } from "@/components/ui/empty-state";
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";
import { getAccountHealthWithDelta } from "@/lib/data-v2/account-health";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";

export default async function InternalClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyResult = await getCompanyById(id);

  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta cuenta</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  const account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;

  if (!account) {
    return (
      <main className="p-4 md:p-6">
        <EmptyState context="diagnosticos" />
      </main>
    );
  }

  const healthResult = await getAccountHealthWithDelta(account.id);
  if (!healthResult.success || !healthResult.data) {
    return (
      <main className="p-4 md:p-6">
        <EmptyState context="diagnosticos" />
      </main>
    );
  }

  const health = healthResult.data.current;
  const delta = healthResult.data.delta;

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-[#6B6B6B]">Cartera interna</p>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{companyResult.data.name}</h1>
        </div>
        <Link href={`/internal/clients/${id}/diagnostic/new`} className="bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Nuevo diagnostico
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
          <ScoreDisplay score={health.score_global} delta={delta} size="lg" animated />
          <BlockScoresRow
            scores={{
              salud: Number(health.score_salud ?? 0),
              publicaciones: Number(health.score_publicaciones ?? 0),
              ads: health.score_ads === null ? null : Number(health.score_ads),
              logistica: Number(health.score_logistica ?? 0),
              stock: Number(health.score_stock ?? 0)
            }}
          />
        </div>
        <RecommendationsPanel clientId={id} maxVisible={5} />
      </section>
    </main>
  );
}
