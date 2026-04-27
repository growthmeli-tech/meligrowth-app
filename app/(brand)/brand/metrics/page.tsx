import { ScoreEvolutionChart } from "@/components/charts/score-evolution-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { listAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { getPrimaryAccountForManager } from "@/lib/data-v2/viewer";

export default async function BrandMetricsPage() {
  const accountResult = await getPrimaryAccountForManager();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="historial" />;
  }

  const historyResult = await listAccountHealthByAccount(accountResult.data.id, 6);
  if (!historyResult.success || !historyResult.data) {
    return <EmptyState context="historial" />;
  }

  const chartData = [...historyResult.data]
    .reverse()
    .map((item) => ({
      date: new Date(item.snapshot_date).toLocaleDateString("es-AR", { month: "short" }),
      score_global: item.score_global,
      score_salud: item.score_salud ?? undefined,
      score_ads: item.score_ads ?? undefined
    }));

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Evolucion 6 meses</h1>
      </header>
      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <ScoreEvolutionChart data={chartData} showBlocks />
      </section>
    </main>
  );
}
