import Link from "next/link";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Recommendation } from "@/lib/recommendations/types";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { getOperationalPriorityCopy, translateOperationalCopy } from "@/lib/ops/copy";
import type { AlertPriority } from "@/lib/types/enums";

const PRIORITIES: Array<AlertPriority | "all"> = ["all", "urgente", "alta", "media", "baja"];

export default async function OpsAlertsPage({
  searchParams
}: {
  searchParams?: Promise<{ prioridad?: AlertPriority | "all" }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPriority = PRIORITIES.includes((resolvedSearchParams.prioridad ?? "all") as AlertPriority | "all")
    ? ((resolvedSearchParams.prioridad ?? "all") as AlertPriority | "all")
    : "all";

  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) return <EmptyState context="recomendaciones" />;
  const account = accountResult.data;

  const alertsResult = await listAlertsByAccount(account.id, { audience: "operator", includeResolved: false, limit: 30 });
  if (!alertsResult.success || !alertsResult.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar alertas operativas.</div>;
  }

  const sortedAlerts = [...alertsResult.data].sort((a, b) => priorityOrder(a.prioridad) - priorityOrder(b.prioridad));
  const recommendations: Recommendation[] = sortedAlerts.map((alert) => ({
    id: alert.id,
    categoria: (alert.categoria as Recommendation["categoria"]) ?? "salud",
    prioridad: alert.prioridad,
    titulo: getOperationalPriorityCopy(alert).title,
    descripcion: translateOperationalCopy(alert.descripcion ?? alert.titulo),
    accion_concreta: translateOperationalCopy(alert.accion_concreta ?? "Revisar alerta"),
    metrica_afectada: alert.categoria ?? "general",
    impacto_estimado: "Impacto directo",
    benchmark_objetivo: translateOperationalCopy(alert.benchmark_objetivo ?? "Mejorar"),
    audiencia: alert.audiencia,
    bloque: alert.categoria ?? "General"
  }));

  const filtered = selectedPriority === "all" ? recommendations : recommendations.filter((item) => item.prioridad === selectedPriority);
  if (filtered.length === 0) {
    return (
      <main className="space-y-4">
        <header>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Alertas operativas</h1>
        </header>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-2">
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((priority) => (
              <Link
                key={priority}
                href={`/ops/alerts${priority === "all" ? "" : `?prioridad=${priority}`}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${selectedPriority === priority ? "bg-[#FFD600] text-[#1A1A1A]" : "bg-[#F5F5F0] text-[#1A1A1A]"}`}
              >
                {priority === "all" ? "Todas" : priority}
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center text-sm text-[#1A1A1A]">
          No hay alertas activas. Tu cuenta está al día ✅
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Alertas operativas</h1>
      </header>
      <div className="rounded-xl border border-[#E8E8E2] bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((priority) => (
            <Link
              key={priority}
              href={`/ops/alerts${priority === "all" ? "" : `?prioridad=${priority}`}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${selectedPriority === priority ? "bg-[#FFD600] text-[#1A1A1A]" : "bg-[#F5F5F0] text-[#1A1A1A]"}`}
            >
              {priority === "all" ? "Todas" : priority}
            </Link>
          ))}
        </div>
      </div>
      <section className="space-y-3">
        {filtered.map((recommendation) => (
          <RecommendationCard key={recommendation.id} recommendation={recommendation} variant="operator" mlAccountId={account.id} />
        ))}
      </section>
    </main>
  );
}

function priorityOrder(priority: AlertPriority) {
  if (priority === "urgente") return 0;
  if (priority === "alta") return 1;
  if (priority === "media") return 2;
  return 3;
}
