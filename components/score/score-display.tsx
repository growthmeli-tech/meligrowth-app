"use client";

import { useEffect, useMemo, useState } from "react";
import { getScoreLabel, getScoreTailwind } from "@/lib/utils/scores";
import { cn } from "@/lib/utils";

type ScoreDisplayProps = {
  score: number;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showDelta?: boolean;
  animated?: boolean;
};

const SIZE_STYLES: Record<NonNullable<ScoreDisplayProps["size"]>, { score: string; delta: string }> = {
  sm: { score: "text-lg font-bold", delta: "text-xs" },
  md: { score: "text-2xl font-bold", delta: "text-sm" },
  lg: { score: "text-6xl font-black leading-none", delta: "text-base" }
};

export function ScoreDisplay({
  score,
  delta = null,
  size = "md",
  showLabel = true,
  showDelta = true,
  animated = false
}: ScoreDisplayProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const [displayScore, setDisplayScore] = useState(animated ? 0 : safeScore);
  const scoreStyles = useMemo(() => SIZE_STYLES[size], [size]);
  const tailwind = getScoreTailwind(safeScore);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(safeScore);
      return;
    }

    let frame = 0;
    let current = 0;
    const durationMs = 700;
    const totalFrames = 24;
    const stepMs = durationMs / totalFrames;

    const id = window.setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      const eased = 1 - (1 - progress) ** 3;
      current = Math.round(safeScore * eased);
      setDisplayScore(Math.min(current, safeScore));
      if (frame >= totalFrames) window.clearInterval(id);
    }, stepMs);

    return () => window.clearInterval(id);
  }, [safeScore, animated]);

  return (
    <div className="space-y-2">
      <div className={cn("font-mono", scoreStyles.score)}>{displayScore}</div>
      {showLabel ? <div className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-semibold", tailwind)}>{getScoreLabel(safeScore)}</div> : null}
      {showDelta ? <DeltaLabel delta={delta} className={scoreStyles.delta} /> : null}
    </div>
  );
}

function DeltaLabel({ delta, className }: { delta: number | null; className: string }) {
  if (delta === null || delta === undefined) return <p className={cn("font-medium text-zinc-500", className)}>Base inicial</p>;
  if (delta === 0) return <p className={cn("font-medium text-zinc-500", className)}>Sin cambios</p>;
  const positive = delta > 0;
  return (
    <p className={cn("font-semibold", className, positive ? "text-green-600" : "text-red-600")}>
      {positive ? "↑" : "↓"}
      {positive ? `+${delta}` : delta} pts
    </p>
  );
}
