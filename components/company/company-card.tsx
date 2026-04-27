"use client";

import Link from "next/link";
import { ScoreDisplay } from "@/components/score/score-display";
import { PlanBadge } from "@/components/ui/plan-badge";
import { cn } from "@/lib/utils";

export type CompanyCardProps = {
  id: string;
  name: string;
  plan: "360" | "360_copilot";
  score: number | null;
  delta?: number | null;
  estado?: string | null;
  responsible?: string | null;
  urgentAlerts?: number;
  href?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

export function CompanyCard({
  id,
  name,
  plan,
  score,
  delta = null,
  estado = null,
  responsible = null,
  urgentAlerts = 0,
  href,
  loading = false,
  error = null,
  empty = false
}: CompanyCardProps) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-gray-200 animate-pulse" />;
  }

  if (error) {
    return (
      <div className="relative bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm font-medium text-red-600">No pudimos cargar esta cuenta</p>
        <button type="button" className="mt-2 text-sm font-semibold text-[#1A1A1A] hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="relative bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm font-medium text-[#6B6B6B]">No hay empresas en cartera</p>
        <p className="mt-1 text-sm font-semibold text-[#1A1A1A]">Agregar empresa →</p>
      </div>
    );
  }

  const leftBorder = plan === "360" ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-[#FFD600]";
  const containerClassName = cn(
    "relative bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4",
    leftBorder,
    "hover:shadow-md hover:bg-gray-50/50 cursor-pointer transition-all duration-200"
  );

  const content = (
    <article className={containerClassName}>
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#1A1A1A]">{name}</p>
            <PlanBadge plan={plan} />
            {urgentAlerts > 0 ? (
              <span className="bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full animate-pulse">{`🔴 ${urgentAlerts} urgente`}</span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {typeof score === "number" ? (
              <ScoreDisplay size="md" score={score} delta={delta} showLabel showDelta />
            ) : (
              <p className="text-xs text-[#6B6B6B]">Sin diagnostico</p>
            )}
          </div>

          <p className="mt-1 text-xs text-[#6B6B6B]">
            {`Responsable: ${responsible ?? "Sin asignar"} · ${estado ?? "Activa"}`}
          </p>
        </div>

        <p className="text-sm font-semibold text-[#1A1A1A] hover:underline">Ver cuenta →</p>
      </div>
    </article>
  );

  if (!href) return content;
  return <Link href={href || `/internal/clients/${id}`}>{content}</Link>;
}
