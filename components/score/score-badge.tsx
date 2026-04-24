import { getEstado } from "@/lib/scoring";
import { estadoColors, estadoLabels } from "@/lib/theme";
import type { Estado } from "@/lib/types";

export function ScoreBadge({ estado, score }: { estado?: Estado; score?: number }) {
  const resolved = estado ?? getEstado(score ?? 0);
  const colors = estadoColors[resolved];
  return (
    <span
      className="inline-flex min-h-7 items-center rounded-component px-2.5 text-xs font-semibold"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {estadoLabels[resolved]}
    </span>
  );
}
