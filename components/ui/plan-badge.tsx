"use client";

import { DESIGN_TOKENS } from "@/lib/config/design-tokens";
import { cn } from "@/lib/utils";

export type PlanBadgeProps = {
  plan: "360" | "360_copilot" | null | undefined;
  loading?: boolean;
  error?: boolean;
};

export function PlanBadge({ plan, loading = false, error = false }: PlanBadgeProps) {
  if (loading) {
    return <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />;
  }

  if (error) {
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center bg-red-100 text-red-700 border border-red-200">Error plan</span>;
  }

  if (plan === "360") {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center transition-colors duration-150 bg-blue-100 text-blue-700 border border-blue-200 hover:brightness-95">
        360°
      </span>
    );
  }

  if (plan === "360_copilot") {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center transition-colors duration-150 bg-[#FFD600]/20 text-[#1A1A1A] border border-[#FFD600] hover:brightness-95">
        {DESIGN_TOKENS.plans.copilot360.label}
      </span>
    );
  }

  return (
    <span className={cn("text-[11px] text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center", "bg-gray-100 text-gray-600 border border-gray-200")}>
      Plan desconocido
    </span>
  );
}
