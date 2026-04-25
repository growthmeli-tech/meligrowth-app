"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

type RecommendationCardProps = {
  recommendation: Recommendation;
  onCreateAction?: (rec: Recommendation) => void;
  onMarkViewed?: (id: string) => void;
  compact?: boolean;
};

const PRIORITY_STYLES: Record<Recommendation["prioridad"], string> = {
  urgente: "border-l-red-600",
  alta: "border-l-orange-500",
  media: "border-l-amber-400",
  baja: "border-l-blue-500"
};

const PRIORITY_BADGE: Record<Recommendation["prioridad"], string> = {
  urgente: "bg-red-600 text-white",
  alta: "bg-orange-500 text-white",
  media: "bg-amber-400 text-[#1A1A1A]",
  baja: "bg-blue-500 text-white"
};

export function RecommendationCard({ recommendation, onCreateAction, onMarkViewed, compact = false }: RecommendationCardProps) {
  return (
    <article className={cn("rounded-xl border border-black/10 border-l-4 bg-white p-4", PRIORITY_STYLES[recommendation.prioridad])}>
      <header className="flex flex-wrap items-center gap-2">
        <Badge className={PRIORITY_BADGE[recommendation.prioridad]}>{recommendation.prioridad.toUpperCase()}</Badge>
        <Badge className="bg-zinc-100 text-zinc-700">{recommendation.bloque}</Badge>
      </header>

      <h3 className="mt-3 text-base font-bold text-zinc-950">{recommendation.titulo}</h3>
      {!compact ? <p className="mt-1 text-sm text-zinc-600">{recommendation.descripcion}</p> : null}

      <section className="mt-3 rounded-lg border border-black/10 bg-zinc-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Qué hacer</p>
        <p className="mt-1 text-sm font-medium text-zinc-800">{recommendation.accion_concreta}</p>
      </section>

      <footer className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Métrica: </span>
          <span className="font-semibold">{recommendation.metrica_afectada}</span>
        </p>
        <p>
          <span className="text-zinc-500">Objetivo: </span>
          <span className="font-semibold">{recommendation.benchmark_objetivo}</span>
        </p>
        <p>
          <span className="text-zinc-500">Impacto: </span>
          <span className="font-semibold">{recommendation.impacto_estimado}</span>
        </p>
      </footer>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onCreateAction?.(recommendation)}>
          Crear acción
        </Button>
        <Button type="button" variant="secondary" onClick={() => onMarkViewed?.(recommendation.id)}>
          Marcar vista
        </Button>
      </div>
    </article>
  );
}
