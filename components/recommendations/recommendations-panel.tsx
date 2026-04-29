import Link from "next/link";
import { RecommendationsMarkableList } from "@/components/recommendations/recommendations-markable-list";
import { EmptyState } from "@/components/ui/empty-state";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { sortByPriority } from "@/lib/recommendations/priorities";
import type { Recommendation, RecommendationCategory } from "@/lib/recommendations/types";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

type RecommendationsPanelProps = {
  clientId: string;
  diagnosticId?: string;
  maxVisible?: number;
  filterByCategory?: RecommendationCategory;
};

export async function RecommendationsPanel({ clientId, diagnosticId, maxVisible = 3, filterByCategory }: RecommendationsPanelProps) {
  const accountResult = await listMlAccountsByCompany(clientId, { activeOnly: true });
  if (!accountResult.success) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No pudimos cargar recomendaciones ahora. Reintentá en unos minutos.
      </section>
    );
  }

  if (!accountResult.data) {
    return <LoadingSkeleton variant="recommendation-list" rows={3} />;
  }

  const account = accountResult.data[0];
  if (!account) return <EmptyState context="recomendaciones" />;

  const alertsResult = await listAlertsByAccount(account.id, { includeResolved: false });
  if (!alertsResult.success || !alertsResult.data) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No pudimos cargar recomendaciones ahora. Reintentá en unos minutos.
      </section>
    );
  }

  const recommendations = alertsResult.data.map<Recommendation>((alert) => ({
    id: alert.id,
    categoria: (alert.categoria as RecommendationCategory) ?? "salud",
    prioridad: alert.prioridad,
    titulo: alert.titulo,
    descripcion: alert.descripcion ?? "",
    accion_concreta: alert.accion_concreta ?? "Revisar cuenta",
    metrica_afectada: alert.categoria ?? "general",
    impacto_estimado: "Impacto alto",
    benchmark_objetivo: alert.benchmark_objetivo ?? "Mejorar metrica",
    audiencia: alert.audiencia,
    bloque: alert.categoria ?? "General"
  }));

  const allRecommendations = sortByPriority(recommendations);
  const filtered = filterByCategory ? allRecommendations.filter((item) => item.categoria === filterByCategory) : allRecommendations;

  if (filtered.length === 0) return <EmptyState context="recomendaciones" />;

  const visible = filtered.slice(0, maxVisible);

  return (
    <section className="space-y-4 rounded-xl border border-black/10 bg-white p-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Recomendaciones del motor</p>
        <h2 className="mt-1 text-lg font-bold text-zinc-950">Acciones prioritarias para esta cuenta</h2>
      </header>

      <RecommendationsMarkableList
        initialRecommendations={visible}
        totalFilteredCount={filtered.length}
        mlAccountId={account.id}
      />

      {filtered.length > maxVisible ? (
        <Link href={`/internal/clients/${clientId}`} className="inline-flex text-sm font-semibold text-brand-dark">
          Ver todas las recomendaciones ({filtered.length})
        </Link>
      ) : null}
    </section>
  );
}
