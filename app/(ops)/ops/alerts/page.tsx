import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Recommendation } from "@/lib/recommendations/types";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsAlertsPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) return <EmptyState context="recomendaciones" />;
  const account = accountResult.data;

  const alertsResult = await listAlertsByAccount(account.id, { audience: "operator", includeResolved: false, limit: 30 });
  if (!alertsResult.success || !alertsResult.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar alertas operativas.</div>;
  }

  const recommendations: Recommendation[] = alertsResult.data.map((alert) => ({
    id: alert.id,
    categoria: (alert.categoria as Recommendation["categoria"]) ?? "salud",
    prioridad: alert.prioridad,
    titulo: alert.titulo,
    descripcion: alert.descripcion ?? "",
    accion_concreta: alert.accion_concreta ?? "Revisar alerta",
    metrica_afectada: alert.categoria ?? "general",
    impacto_estimado: "Impacto directo",
    benchmark_objetivo: alert.benchmark_objetivo ?? "Mejorar",
    audiencia: alert.audiencia,
    bloque: alert.categoria ?? "General"
  }));

  if (recommendations.length === 0) return <EmptyState context="recomendaciones" />;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Alertas operativas</h1>
      </header>
      <section className="space-y-3">
        {recommendations.map((recommendation) => (
          <RecommendationCard key={recommendation.id} recommendation={recommendation} variant="operator" mlAccountId={account.id} />
        ))}
      </section>
    </main>
  );
}
