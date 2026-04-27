import Link from "next/link";
import { PriorityList } from "@/components/ops/priority-list";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsDashboardPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="tareas" />;
  }

  const [healthResult, alertsResult] = await Promise.all([
    getLatestAccountHealthByAccount(accountResult.data.id),
    listAlertsByAccount(accountResult.data.id, { audience: "operator", includeResolved: false, limit: 5 })
  ]);

  if (!healthResult.success || !healthResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const priorities = (alertsResult.success ? alertsResult.data : []).map((alert) => ({
    id: alert.id,
    title: alert.titulo,
    subtitle: alert.descripcion ?? "Revisar detalle de alerta",
    priority: alert.prioridad
  }));

  const health = healthResult.data;

  return (
    <main className="space-y-4">
      <header>
        <p className="text-sm text-[#6B6B6B]">{accountResult.data.account_name}</p>
        <h1 className="text-xl font-bold text-[#1A1A1A]">{`Hoy: ${priorities.length} alertas`}</h1>
      </header>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <PriorityList items={priorities.slice(0, 3)} />
        {priorities.length > 3 ? (
          <Link href="/ops/alerts" className="mt-2 inline-flex text-sm font-semibold text-[#1A1A1A]">
            Ver todas →
          </Link>
        ) : null}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Bloques</p>
        <div className="mt-2">
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
      </section>
    </main>
  );
}
