import Link from "next/link";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getClientRecommendations, getRecommendationsForDiagnostic } from "@/lib/data/recommendations";
import { sortByPriority } from "@/lib/recommendations/priorities";
import type { Recommendation, RecommendationCategory } from "@/lib/recommendations/types";

type RecommendationsPanelProps = {
  clientId: string;
  diagnosticId?: string;
  maxVisible?: number;
  filterByCategory?: RecommendationCategory;
};

export async function RecommendationsPanel({ clientId, diagnosticId, maxVisible = 3, filterByCategory }: RecommendationsPanelProps) {
  const result = diagnosticId ? await getRecommendationsForDiagnostic(diagnosticId) : await getClientRecommendations(clientId);

  if (!result.success) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No pudimos cargar recomendaciones ahora. Reintentá en unos minutos.
      </section>
    );
  }

  const allRecommendations = sortByPriority(result.data.recomendaciones);
  const filtered = filterByCategory ? allRecommendations.filter((item) => item.categoria === filterByCategory) : allRecommendations;

  if (filtered.length === 0) return <EmptyState context="recomendaciones" />;

  const visible = filtered.slice(0, maxVisible);
  const grouped = filtered.length > 5 ? groupByBlock(visible) : null;

  return (
    <section className="space-y-4 rounded-xl border border-black/10 bg-white p-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Recomendaciones del motor</p>
        <h2 className="mt-1 text-lg font-bold text-zinc-950">{result.data.estrategia_general}</h2>
      </header>

      {grouped ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([block, recommendations]) => (
            <div key={block} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{block}</p>
              {recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.id} recommendation={recommendation} compact />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} compact />
          ))}
        </div>
      )}

      {filtered.length > maxVisible ? (
        <Link href={`/operator/clients/${clientId}?tab=acciones`} className="inline-flex text-sm font-semibold text-brand-dark">
          Ver todas las recomendaciones ({filtered.length})
        </Link>
      ) : null}
    </section>
  );
}

function groupByBlock(items: Recommendation[]) {
  return items.reduce<Record<string, Recommendation[]>>((acc, item) => {
    const key = item.bloque || "General";
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
}
