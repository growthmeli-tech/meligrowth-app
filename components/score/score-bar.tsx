import { getEstado } from "@/lib/scoring";
import { estadoColors } from "@/lib/theme";

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const colors = estadoColors[getEstado(score)];
  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-zinc-700">{label}</span>
          <span className="font-semibold text-zinc-950">{score}</span>
        </div>
      ) : null}
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: colors.fill }} />
      </div>
    </div>
  );
}
