"use client";

import { useEffect, useMemo, useState } from "react";
import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";
import { cn } from "@/lib/utils";
import { getScoreStatus } from "@/lib/utils/scores";

export type ScoreDisplayProps = {
  score: number;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showDelta?: boolean;
  animated?: boolean;
  updatedAt?: string | null;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

export function ScoreDisplay({
  score,
  delta = null,
  size = "md",
  showLabel = true,
  showDelta = true,
  animated = false,
  updatedAt = null,
  loading = false,
  error = null,
  empty = false
}: ScoreDisplayProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6">
        <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-4xl font-black leading-none font-mono tabular-nums text-red-600">--</p>
        <p className="text-sm font-medium text-red-600">No pudimos calcular el score</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-4xl font-black leading-none font-mono tabular-nums text-[#6B6B6B]">--</p>
        <p className="text-sm font-medium text-[#1A1A1A]">Sin score aun</p>
        <p className="text-xs text-[#6B6B6B]">Crea el primer diagnostico para ver estado</p>
      </div>
    );
  }

  return (
    <ScoreDisplayContent
      score={score}
      delta={delta}
      size={size}
      showLabel={showLabel}
      showDelta={showDelta}
      animated={animated}
      updatedAt={updatedAt}
    />
  );
}

type ScoreDisplayContentProps = Omit<ScoreDisplayProps, "loading" | "error" | "empty">;

function ScoreDisplayContent({
  score,
  delta,
  size,
  showLabel,
  showDelta,
  animated,
  updatedAt
}: ScoreDisplayContentProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const status = getScoreStatus(safeScore) as ScoreStatusKey;
  const tone = DESIGN_TOKENS.score[status];
  const label = tone.label;
  const [displayScore, setDisplayScore] = useState(animated ? 0 : safeScore);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(safeScore);
      return;
    }

    const start = performance.now();
    const duration = 800;
    let raf = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(safeScore * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeScore, animated]);

  if (size === "lg") {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 md:min-h-[280px]">
        <p className="text-6xl font-black leading-none font-mono tabular-nums md:text-8xl" style={{ color: tone.color }}>
          {displayScore}
        </p>
        {showLabel ? <p className="text-lg font-medium" style={{ color: tone.color }}>{`Tu cuenta esta ${label}`}</p> : null}
        {showDelta ? <DeltaText delta={delta ?? null} className="text-sm font-semibold transition-opacity duration-200" /> : null}
        {updatedAt ? <p className="text-xs text-[#6B6B6B]">{`Actualizado: ${updatedAt}`}</p> : null}
      </div>
    );
  }

  if (size === "md") {
    return (
      <div className="flex items-center gap-2">
        <p className="w-[5ch] text-4xl font-black font-mono tabular-nums" style={{ color: tone.color }}>
          {displayScore}
        </p>
        {showLabel ? (
          <span className="rounded-full border px-2 py-0.5 text-xs font-bold" style={{ color: tone.color, backgroundColor: tone.bg, borderColor: tone.border }}>
            {label}
          </span>
        ) : null}
        {showDelta ? <DeltaText delta={delta ?? null} className="text-xs font-semibold transition-opacity duration-200" /> : null}
      </div>
    );
  }

  const progress = `${safeScore}%`;
  return (
    <div className="flex items-center gap-2">
      <p className="w-[3ch] text-2xl font-bold font-mono tabular-nums" style={{ color: tone.color }}>
        {displayScore}
      </p>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className="h-1.5 rounded-full" style={{ width: progress, backgroundColor: tone.color }} />
      </div>
      {showLabel ? <p className="text-xs font-medium" style={{ color: tone.color }}>{label}</p> : null}
    </div>
  );
}

function DeltaText({ delta, className }: { delta: number | null; className: string }) {
  if (delta === null || delta === undefined) return <p className={cn("text-[#6B6B6B]", className)}>Base inicial</p>;
  if (delta === 0) return <p className={cn("text-[#6B6B6B]", className)}>Sin cambios</p>;
  const up = delta > 0;
  return <p className={cn(className, up ? "text-green-600" : "text-red-600")}>{up ? `↑+${delta} pts` : `↓${delta} pts`}</p>;
}
