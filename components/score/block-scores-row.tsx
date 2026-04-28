"use client";

import Link from "next/link";
import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";
import { cn } from "@/lib/utils";
import { getScoreStatus } from "@/lib/utils/scores";

type BlockKey = "salud" | "publicaciones" | "ads" | "logistica" | "stock";

export type BlockScoresRowProps = {
  scores: {
    salud: number;
    publicaciones: number;
    ads: number | null;
    logistica: number;
    stock: number;
  };
  interactive?: boolean;
  linkBasePath?: string;
  activeBlock?: BlockKey | null;
  onSelectBlock?: (block: BlockKey) => void;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

const BLOCKS: Array<{ key: BlockKey; number: string; label: string }> = [
  { key: "salud", number: "01", label: "Salud" },
  { key: "publicaciones", number: "02", label: "Pubs" },
  { key: "ads", number: "03", label: "Ads" },
  { key: "logistica", number: "04", label: "Log." },
  { key: "stock", number: "05", label: "Stock" }
];

export function BlockScoresRow({
  scores,
  interactive = false,
  linkBasePath,
  activeBlock = null,
  onSelectBlock,
  loading = false,
  error = null,
  empty = false
}: BlockScoresRowProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-14 w-14 animate-pulse rounded-lg bg-gray-200 md:h-16 md:w-16" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-medium text-red-600">Error cargando bloques</p>;
  }

  if (empty) {
    return <p className="text-sm font-medium text-[#6B6B6B]">Sin bloques disponibles para esta cuenta</p>;
  }

  const worstBlock = getWorstBlock(scores);

  return (
    <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible">
      {BLOCKS.map(({ key, number, label }) => {
        const value = scores[key];
        const status = typeof value === "number" ? (getScoreStatus(value) as ScoreStatusKey) : null;
        const tone = status ? DESIGN_TOKENS.score[status] : null;
        const isWorst = key === worstBlock;
        const isActive = key === activeBlock;

        const baseClass = cn(
          "h-14 w-14 rounded-lg border border-[#E8E8E2] bg-white flex flex-col items-center justify-center md:h-16 md:w-16",
          "transition-all duration-150",
          interactive && "cursor-pointer hover:scale-105 hover:ring-2 hover:ring-[#FFD600]",
          isWorst && "ring-2 ring-offset-1 shadow-sm",
          isActive && "ring-2 ring-[#FFD600]"
        );

        const content = (
          <>
            <p className="text-[10px] font-bold text-[#6B6B6B]">{number}</p>
            <p className="text-sm font-black font-mono tabular-nums" style={{ color: tone?.color ?? "#6B6B6B" }}>
              {value ?? "--"}
            </p>
            <p className="text-[10px] font-medium text-[#6B6B6B]">{value === null ? "Sin datos" : label}</p>
          </>
        );

        if (interactive && linkBasePath) {
          return (
            <Link key={key} href={`${linkBasePath}/${key}`} className={baseClass} title="Click para ver detalle del bloque">
              {content}
            </Link>
          );
        }

        if (interactive) {
          return (
            <button key={key} type="button" className={baseClass} onClick={() => onSelectBlock?.(key)} title="Click para ver detalle del bloque">
              {content}
            </button>
          );
        }

        return (
          <div key={key} className={baseClass}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function getWorstBlock(scores: BlockScoresRowProps["scores"]): BlockKey | null {
  const entries = Object.entries(scores).filter((entry): entry is [BlockKey, number] => typeof entry[1] === "number");
  if (entries.length === 0) return null;
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}
