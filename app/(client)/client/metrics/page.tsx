import Link from "next/link";
import { ScoreHistoryChart } from "@/components/charts/score-history-chart";
import { AppShell } from "@/components/layout/app-shell";
import { ScoreBadge } from "@/components/score/score-badge";
import { Card } from "@/components/ui/card";
import { getClientDashboardBundle } from "@/lib/data";
import { addScoreDeltas, filterHistoryByPeriod, getCurrentAndPreviousHistory, normalizeHistoryPeriod } from "@/lib/history";
import { clientBlockLabels } from "@/lib/theme";
import type { BlockKey } from "@/lib/types";

export default async function ClientMetricsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const { diagnostic, history } = await getClientDashboardBundle();
  const period = normalizeHistoryPeriod(resolvedSearchParams.period);
  const filteredHistory = filterHistoryByPeriod(history, period);
  const { current, previous } = getCurrentAndPreviousHistory(history);
  const latestDelta = addScoreDeltas(history).at(-1)?.delta ?? null;
  const rows = Object.entries(diagnostic.scores) as Array<[BlockKey, number]>;
  return (
    <AppShell mode="client">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Tu cuenta</div>
          <h1 className="text-3xl font-bold">Mis métricas</h1>
          <p className="mt-2 text-zinc-600">Valores actuales, benchmark y comparación con el período anterior.</p>
        </div>
        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Evolución</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {latestDelta === null ? "Sin período anterior" : `Último cambio: ${latestDelta > 0 ? "+" : ""}${latestDelta} pts`}
                </p>
              </div>
              <PeriodNav period={period} />
            </div>
            <ScoreHistoryChart data={filteredHistory} />
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-bold">Detalle por área</h2>
            <div className="space-y-3">
              {rows.map(([key, score]) => (
                <div key={key} className="flex items-center justify-between rounded-component border border-black/10 p-3">
                  <div>
                    <div className="font-semibold">{clientBlockLabels[key]}</div>
                    <div className="text-sm text-zinc-500">Anterior: {previous?.[key] ?? "-"} · Actual: {current?.[key] ?? score}</div>
                  </div>
                  <ScoreBadge score={score} />
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function PeriodNav({ period }: { period: 3 | 6 | 12 }) {
  return (
    <div className="flex rounded-component border border-black/10 p-1 text-sm">
      {[3, 6, 12].map((months) => (
        <Link key={months} href={`/client/metrics?period=${months}`} className={`rounded-[6px] px-3 py-1 font-semibold ${period === months ? "bg-brand-light text-brand-dark" : "text-zinc-500"}`}>
          {months}m
        </Link>
      ))}
    </div>
  );
}
