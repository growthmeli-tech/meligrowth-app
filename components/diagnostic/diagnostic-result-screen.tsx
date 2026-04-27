import Link from "next/link";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { ScoreDisplay } from "@/components/score/score-display";
import { Button } from "@/components/ui/button";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";

type DiagnosticResultScreenProps = {
  score: number;
  estado: string;
  delta: number | null;
  recommendations: DiagnosticRecommendations;
  clientId: string;
  diagnosticId: string;
};

export function DiagnosticResultScreen({ score, estado, delta, recommendations, clientId }: DiagnosticResultScreenProps) {
  const topRecommendations = recommendations.recomendaciones.slice(0, 3);

  return (
    <section className="space-y-5 rounded-xl border border-green-200 bg-green-50 p-6">
      <div>
        <p className="text-sm font-semibold text-green-700">Diagnóstico guardado</p>
        <h2 className="mt-1 text-2xl font-bold text-zinc-950">Resultado final</h2>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <ScoreDisplay score={score} delta={delta} size="lg" animated />
        <p className="mt-2 text-sm text-zinc-600">Estado actual: {estado.replaceAll("_", " ")}</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-zinc-600">Recomendaciones generadas</p>
        {topRecommendations.map((recommendation) => (
          <RecommendationCard key={recommendation.id} recommendation={recommendation} compact />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/internal/clients/${clientId}`}>
          <Button>Ver cuenta completa</Button>
        </Link>
        <Link href={`/internal/clients/${clientId}`}>
          <Button variant="secondary">Generar reporte quincenal</Button>
        </Link>
      </div>
    </section>
  );
}
