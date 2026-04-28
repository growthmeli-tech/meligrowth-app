"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DESIGN_TOKENS } from "@/lib/config/design-tokens";
import { createTaskFromRecommendation } from "@/app/(internal)/internal/clients/[id]/tasks/actions";
import type { Recommendation } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

export type RecommendationCardProps = {
  recommendation: Recommendation;
  variant?: "operator" | "manager";
  onCreateAction?: (rec: Recommendation) => void;
  onMarkViewed?: (id: string) => void;
  compact?: boolean;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  mlAccountId?: string;
};

const PRIORITY_STYLES: Record<Recommendation["prioridad"], string> = {
  urgente: "border-l-red-600",
  alta: "border-l-orange-500",
  media: "border-l-amber-400",
  baja: "border-l-blue-500"
};

export function RecommendationCard({
  recommendation,
  variant = "operator",
  onCreateAction,
  onMarkViewed,
  compact = false,
  loading = false,
  error = null,
  empty = false,
  mlAccountId
}: RecommendationCardProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [wasCreated, setWasCreated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (loading) {
    return <div className="h-32 rounded-xl bg-gray-200 animate-pulse" />;
  }

  if (error) {
    return (
      <article className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm text-red-600">No se pudieron cargar recomendaciones</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Reintentar
        </button>
      </article>
    );
  }

  if (empty) {
    return (
      <article className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm text-[#6B6B6B]">No hay recomendaciones activas</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Crear accion preventiva
        </button>
      </article>
    );
  }

  const priorityTone = DESIGN_TOKENS.alerts[recommendation.prioridad];

  return (
    <article className={cn("bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4 hover:shadow-md transition-shadow duration-200", "border-l-4", PRIORITY_STYLES[recommendation.prioridad])}>
      <header className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]" style={{ color: priorityTone.text }}>
          {`${recommendation.prioridad} · ${recommendation.bloque}`}
        </p>
        {recommendation.prioridad === "urgente" ? <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> : null}
      </header>

      <h3 className="mt-2 text-sm font-semibold text-[#1A1A1A] line-clamp-2">{recommendation.titulo}</h3>
      {!compact ? <p className="mt-1 text-sm text-[#6B6B6B]">{recommendation.descripcion}</p> : null}

      {variant === "operator" ? (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">QUE HACER</p>
          <p className="mt-1 text-sm text-[#6B6B6B]">{recommendation.accion_concreta}</p>
          <p className="mt-2 text-sm text-[#6B6B6B]">{`Objetivo: ${recommendation.benchmark_objetivo} · Impacto: ${recommendation.impacto_estimado}`}</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-[#6B6B6B]">{recommendation.descripcion}</p>
          <p className="mt-2 text-sm text-[#6B6B6B]">{`Impacto estimado si se resuelve: ${recommendation.impacto_estimado}`}</p>
        </div>
      )}

      <div className={cn("mt-4 flex gap-2", variant === "operator" ? "flex-col sm:flex-row sm:justify-between" : "justify-start")}>
        <button
          type="button"
          className="bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2 disabled:opacity-70"
          disabled={isPending}
          onClick={() => {
            setActionError(null);
            startTransition(async () => {
              if (mlAccountId) {
                const taskResult = await createTaskFromRecommendation({
                  ml_account_id: mlAccountId,
                  titulo: recommendation.titulo,
                  descripcion: recommendation.accion_concreta,
                  prioridad: recommendation.prioridad,
                  alert_id: recommendation.id
                });

                if (!taskResult.success) {
                  setActionError(taskResult.error);
                  return;
                }

                setWasCreated(true);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setWasCreated(false), 2000);
              }

              onCreateAction?.(recommendation);
            });
          }}
        >
          {wasCreated ? "✓ Tarea creada" : variant === "manager" ? "Solicitar accion al equipo operativo →" : "Crear tarea"}
        </button>
        {variant === "operator" ? (
          <button type="button" className="text-gray-500 hover:text-[#1A1A1A] text-sm font-medium" onClick={() => onMarkViewed?.(recommendation.id)}>
            Marcar vista ✓
          </button>
        ) : null}
      </div>
      {actionError ? <p className="mt-2 text-xs text-red-600">{actionError}</p> : null}
    </article>
  );
}
