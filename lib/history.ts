import type { BlockKey } from "@/lib/types";

export type ScoreHistoryPoint = {
  date: string;
  scoreGlobal: number;
} & Record<BlockKey, number>;

export type HistoryPeriod = 3 | 6 | 12;

export function normalizeHistoryPeriod(value: string | undefined): HistoryPeriod {
  if (value === "3" || value === "6" || value === "12") return Number(value) as HistoryPeriod;
  return 6;
}

export function filterHistoryByPeriod(data: ScoreHistoryPoint[], period: HistoryPeriod, now = new Date()) {
  const from = new Date(now);
  from.setMonth(from.getMonth() - period);
  return data.filter((item) => new Date(item.date).getTime() >= from.getTime());
}

export function getCurrentAndPreviousHistory(data: ScoreHistoryPoint[]) {
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return {
    previous: sorted.at(-2) ?? null,
    current: sorted.at(-1) ?? null
  };
}

export function addScoreDeltas(data: ScoreHistoryPoint[]) {
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return sorted.map((item, index) => ({
    ...item,
    delta: index === 0 ? null : item.scoreGlobal - sorted[index - 1].scoreGlobal
  }));
}
