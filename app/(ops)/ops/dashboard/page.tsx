import Link from "next/link";
import { PriorityList } from "@/components/ops/priority-list";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { listTasksByAccount } from "@/lib/data-v2/tasks";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { getOperationalPriorityCopy } from "@/lib/ops/copy";
import { getScoreLabel } from "@/lib/utils/scores";

export default async function OpsDashboardPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="tareas" />;
  }

  const [healthResult, alertsResult, pendingTasks, inProgressTasks] = await Promise.all([
    getLatestAccountHealthByAccount(accountResult.data.id),
    listAlertsByAccount(accountResult.data.id, { audience: "operator", includeResolved: false, limit: 10 }),
    listTasksByAccount(accountResult.data.id, { status: "pendiente" }),
    listTasksByAccount(accountResult.data.id, { status: "en_curso" })
  ]);

  if (!healthResult.success || !healthResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const alerts = alertsResult.success ? [...alertsResult.data].sort((a, b) => priorityOrder(a.prioridad) - priorityOrder(b.prioridad)) : [];
  const priorities = alerts.slice(0, 3).map((alert) => {
    const copy = getOperationalPriorityCopy(alert);
    return {
      id: alert.id,
      title: copy.title,
      subtitle: copy.subtitle,
      priority: copy.priority,
      href: `/ops/blocks/${copy.block}`
    };
  });

  const health = healthResult.data;
  const pendingCount = pendingTasks.success ? pendingTasks.data.length : 0;
  const inProgressCount = inProgressTasks.success ? inProgressTasks.data.length : 0;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <PriorityList items={priorities} empty={priorities.length === 0} />
        {alerts.length > 3 ? (
          <Link href="/ops/alerts" className="mt-3 inline-flex text-sm font-semibold text-[#1A1A1A]">
            Ver todas las alertas →
          </Link>
        ) : null}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Estado de cuenta</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-4xl font-black text-[#1A1A1A]">{Math.round(Number(health.score_global ?? 0))}</p>
          <p className="pb-1 text-sm font-semibold text-[#6B6B6B]">{getScoreLabel(Number(health.score_global ?? 0))}</p>
        </div>
        <div className="mt-3">
          <BlockScoresRow
            interactive
            linkBasePath="/ops/blocks"
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

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Tareas pendientes</p>
          <Link href="/ops/tasks" className="rounded-lg bg-[#FFD600] px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
            + Nueva
          </Link>
        </div>
        <p className="mt-2 text-sm text-[#1A1A1A]">{`${pendingCount} pendientes · ${inProgressCount} en curso`}</p>
      </section>
    </main>
  );
}

function priorityOrder(priority: "urgente" | "alta" | "media" | "baja") {
  if (priority === "urgente") return 0;
  if (priority === "alta") return 1;
  if (priority === "media") return 2;
  return 3;
}
