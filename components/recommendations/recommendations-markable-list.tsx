"use client";

import { useState, useTransition } from "react";
import { markAlertResolved } from "@/app/(internal)/internal/clients/[id]/actions";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import type { Recommendation } from "@/lib/recommendations/types";

type RecommendationsMarkableListProps = {
  initialRecommendations: Recommendation[];
  /** Same rule as server: group by block when total filtered count exceeds this threshold */
  totalFilteredCount: number;
  mlAccountId: string;
};

function groupByBlock(items: Recommendation[]) {
  return items.reduce<Record<string, Recommendation[]>>((acc, item) => {
    const key = item.bloque || "General";
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
}

export function RecommendationsMarkableList({ initialRecommendations, totalFilteredCount, mlAccountId }: RecommendationsMarkableListProps) {
  const [list, setList] = useState(initialRecommendations);
  const [, start] = useTransition();
  const grouped = totalFilteredCount > 5 ? groupByBlock(list) : null;

  const onMarkViewed = (alertId: string) => {
    start(async () => {
      const previous = list;
      setList((rows) => rows.filter((r) => r.id !== alertId));
      const res = await markAlertResolved(alertId);
      if (!res.success) {
        setList(previous);
        window.alert(res.error);
      }
    });
  };

  if (list.length === 0) {
    return <p className="text-sm text-zinc-600">No hay recomendaciones activas.</p>;
  }

  if (grouped) {
    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([block, recs]) => (
          <div key={block} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{block}</p>
            {recs.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                compact
                mlAccountId={mlAccountId}
                onMarkViewed={onMarkViewed}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          compact
          mlAccountId={mlAccountId}
          onMarkViewed={onMarkViewed}
        />
      ))}
    </div>
  );
}
