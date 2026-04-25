"use client";

import { getScoreTailwind } from "@/lib/utils/scores";
import { cn } from "@/lib/utils";

type BlockScoresRowProps = {
  scores: {
    salud: number;
    publicaciones: number;
    ads: number | null;
    logistica: number;
    stock: number;
  };
  interactive?: boolean;
  onSelectBlock?: (block: "salud" | "publicaciones" | "ads" | "logistica" | "stock") => void;
};

const BLOCKS = [
  { key: "salud", label: "Salud" },
  { key: "publicaciones", label: "Publicaciones" },
  { key: "ads", label: "Ads" },
  { key: "logistica", label: "Logística" },
  { key: "stock", label: "Stock" }
] as const;

export function BlockScoresRow({ scores, interactive = false, onSelectBlock }: BlockScoresRowProps) {
  const validScores = BLOCKS.map(({ key }) => ({ key, value: scores[key] })).filter((item) => item.value !== null) as Array<{
    key: (typeof BLOCKS)[number]["key"];
    value: number;
  }>;
  const worstBlock = validScores.sort((a, b) => a.value - b.value)[0]?.key;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {BLOCKS.map(({ key, label }) => {
        const score = scores[key];
        if (score === null) {
          return (
            <div key={key} className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-500">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 font-mono">Sin datos</p>
            </div>
          );
        }

        const tone = getScoreTailwind(score);
        const isWorst = worstBlock === key;
        const baseClass = cn(
          "rounded-xl border p-3 text-left transition",
          tone,
          isWorst ? "border-2" : "border",
          interactive ? "hover:shadow-sm" : ""
        );

        if (interactive) {
          return (
            <button key={key} type="button" className={baseClass} onClick={() => onSelectBlock?.(key)}>
              <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
              <p className="mt-1 font-mono text-xl font-bold">{score}</p>
            </button>
          );
        }

        return (
          <div key={key} className={baseClass}>
            <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
            <p className="mt-1 font-mono text-xl font-bold">{score}</p>
          </div>
        );
      })}
    </div>
  );
}
