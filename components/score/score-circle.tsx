import { getEstado } from "@/lib/scoring";
import { estadoColors, estadoLabels } from "@/lib/theme";

export function ScoreCircle({ score, size = 168 }: { score: number; size?: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const estado = getEstado(score);
  const colors = estadoColors[estado];

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#F0F0F3" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={colors.fill}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-bold text-zinc-950">{score}</div>
        <div className="mt-1 text-sm font-semibold" style={{ color: colors.text }}>
          {estadoLabels[estado]}
        </div>
      </div>
    </div>
  );
}
