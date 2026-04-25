import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { ActionForm } from "@/components/actions/action-form";
import { ActionList } from "@/components/actions/action-list";
import { BlockComparisonChart } from "@/components/charts/block-comparison-chart";
import { ScoreHistoryChart } from "@/components/charts/score-history-chart";
import { AppShell } from "@/components/layout/app-shell";
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { ScoreBadge } from "@/components/score/score-badge";
import { ScoreBar } from "@/components/score/score-bar";
import { ScoreCircle } from "@/components/score/score-circle";
import { ScoreDisplay } from "@/components/score/score-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOperatorClientBundle, isPlaceholderDiagnostic } from "@/lib/data";
import { addScoreDeltas, filterHistoryByPeriod, getCurrentAndPreviousHistory, normalizeHistoryPeriod } from "@/lib/history";
import { getDecision, getEstado } from "@/lib/scoring";
import { blockLabels, estadoLabels } from "@/lib/theme";
import type { BlockKey } from "@/lib/types";
import { formatPct } from "@/lib/utils";

export default async function OperatorClientPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; period?: string; estado?: string; prioridad?: string; created?: string; completed?: string; error?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { client, diagnostic, actions, history } = await getOperatorClientBundle(resolvedParams.id);
  const withoutDiagnostic = isPlaceholderDiagnostic(diagnostic);
  const tab = resolvedSearchParams.tab ?? "diagnostico";
  const actionStatusFilter = resolvedSearchParams.estado ?? "todas";
  const actionPriorityFilter = resolvedSearchParams.prioridad ?? "todas";
  const period = normalizeHistoryPeriod(resolvedSearchParams.period);
  const filteredHistory = filterHistoryByPeriod(history, period);
  const historyWithDeltas = addScoreDeltas(history);
  const { current: currentHistory, previous: previousHistory } = getCurrentAndPreviousHistory(history);
  const currentDelta = previousHistory ? (currentHistory?.scoreGlobal ?? diagnostic.scoreGlobal) - previousHistory.scoreGlobal : null;
  const decision = getDecision(diagnostic.estadoGlobal, diagnostic.scores);
  const blockRows = (Object.entries(diagnostic.scores) as Array<[BlockKey, number]>).map(([key, score]) => ({ key, score }));
  const comparison = blockRows.map(({ key, score }) => ({
    name: blockLabels[key],
    anterior: previousHistory?.[key] ?? score,
    actual: currentHistory?.[key] ?? score
  }));
  const filteredActions = actions.filter((action) => {
    const statusMatch = actionStatusFilter === "todas" || action.estado === actionStatusFilter;
    const priorityMatch = actionPriorityFilter === "todas" || action.prioridad === actionPriorityFilter;
    return statusMatch && priorityMatch;
  });

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-sm font-semibold text-brand-dark">{client.plan.toUpperCase()}</div>
            <h1 className="text-3xl font-bold text-zinc-950">{client.name}</h1>
            <p className="mt-2 text-zinc-600">
              Seller ID {client.meliSellerId || "sin cargar"} · {withoutDiagnostic ? "Sin diagnóstico inicial" : `Último diagnóstico ${new Date(diagnostic.date).toLocaleDateString("es-AR")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/operator/clients/${client.id}/settings`}>
              <Button variant="secondary">
                <Settings className="h-4 w-4" />
                Configuración
              </Button>
            </Link>
            <Link href={`/operator/clients/${client.id}/diagnostic/new`}>
              <Button>
                <Plus className="h-4 w-4" />
                Cargar nuevo diagnóstico
              </Button>
            </Link>
          </div>
        </div>

        {withoutDiagnostic ? (
          <Card className="border-[#BA7517]/30 bg-[#FAEEDA] text-[#633806]">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-bold">Cliente listo para diagnóstico inicial</h2>
                <p className="mt-1 text-sm opacity-80">La cuenta ya existe en la cartera. Cargá el primer diagnóstico para habilitar score real, evolución y acciones recomendadas.</p>
              </div>
              <Link href={`/operator/clients/${client.id}/diagnostic/new`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Cargar diagnóstico
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <section className="rounded-xl border border-black/10 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Estado de la cuenta</p>
              <div className="mt-2">
                <ScoreDisplay score={diagnostic.scoreGlobal} delta={currentDelta} size="lg" animated />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Actualizado el {new Date(diagnostic.date).toLocaleDateString("es-AR")}</p>
              <div className="mt-4">
                <BlockScoresRow
                  scores={{
                    salud: diagnostic.scores.salud,
                    publicaciones: diagnostic.scores.publicaciones,
                    ads: diagnostic.scores.ads,
                    logistica: diagnostic.scores.logistica,
                    stock: diagnostic.scores.stock
                  }}
                />
              </div>
            </section>
            <RecommendationsPanel clientId={client.id} diagnosticId={diagnostic.id} maxVisible={3} />
          </>
        )}

        <nav className="flex gap-2 border-b border-black/10">
          {[
            ["diagnostico", "Diagnóstico actual"],
            ["evolucion", "Evolución"],
            ["acciones", "Acciones"]
          ].map(([key, label]) => (
            <Link key={key} href={`/operator/clients/${client.id}?tab=${key}`} className={`px-3 py-3 text-sm font-semibold ${tab === key ? "border-b-2 border-brand-purple text-brand-dark" : "text-zinc-500"}`}>
              {label}
            </Link>
          ))}
        </nav>

        {tab === "diagnostico" ? (
          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <Card className="flex flex-col items-center justify-center text-center">
              <ScoreCircle score={diagnostic.scoreGlobal} />
              <h2 className="mt-4 text-xl font-bold">Score global</h2>
              <p className="mt-2 text-sm text-zinc-600">{estadoLabels[diagnostic.estadoGlobal]} según diagnóstico actual.</p>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              {blockRows.map(({ key, score }) => (
                <Card key={key}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{blockLabels[key]}</div>
                    <ScoreBadge score={score} />
                  </div>
                  <div className="mt-4">
                    <ScoreBar score={score} label="Score del bloque" />
                  </div>
                  <div className="mt-3 text-sm text-zinc-500">Peso global: {key === "salud" ? "35%" : key === "stock" ? "10%" : key === "logistica" ? "15%" : "20%"}</div>
                </Card>
              ))}
            </div>
            <Card className="xl:col-span-2">
              <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                <div>
                  <div className="text-sm font-semibold text-brand-dark">Decisión de la semana</div>
                  <h3 className="mt-2 text-2xl font-bold">{decision.title}</h3>
                  <p className="mt-2 text-zinc-600">{decision.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="ACOS" value={formatPct(diagnostic.ads.acos)} score={diagnostic.ads.acos > diagnostic.ads.margen_pre_ads * 0.36 ? 45 : 85} />
                  <Metric label="ROAS" value={diagnostic.ads.roas.toFixed(1)} score={diagnostic.ads.roas >= 7 ? 88 : 58} />
                  <Metric label="TACOS" value={formatPct(diagnostic.ads.tacos)} score={diagnostic.ads.tacos <= 8 ? 86 : 62} />
                </div>
              </div>
            </Card>
            <div className="xl:col-span-2">
              <ActionList actions={actions.sort((a, b) => (a.prioridad > b.prioridad ? 1 : -1))} />
            </div>
          </section>
        ) : null}

        {tab === "evolucion" ? (
          <section className="grid gap-5 xl:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Score global</h2>
                <PeriodNav clientId={client.id} tab={tab} period={period} />
              </div>
              <ScoreHistoryChart data={filteredHistory} />
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-bold">Bloques: anterior vs actual</h2>
              <BlockComparisonChart data={comparison} />
            </Card>
            <Card className="xl:col-span-2">
              <h2 className="mb-4 text-lg font-bold">Historial de diagnósticos</h2>
              <div className="divide-y divide-black/10">
                {historyWithDeltas.map((item) => (
                  <div key={item.date} className="grid grid-cols-3 py-3 text-sm">
                    <span>{item.date}</span>
                    <span className="font-semibold">{item.scoreGlobal}</span>
                    <span className={item.delta === null ? "text-zinc-500" : item.delta >= 0 ? "text-[#639922]" : "text-[#E24B4A]"}>
                      {item.delta === null ? "Base" : `${item.delta > 0 ? "+" : ""}${item.delta}`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {tab === "acciones" ? (
          <section className="space-y-4">
            {resolvedSearchParams.created ? <Notice tone="success" text="Acción creada correctamente." /> : null}
            {resolvedSearchParams.completed ? <Notice tone="success" text="Acción marcada como completada." /> : null}
            {resolvedSearchParams.error === "missing_action" ? <Notice tone="error" text="Ingresá un título para crear la acción." /> : null}
            <ActionForm clientId={client.id} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-zinc-950">Backlog operativo</h2>
	              <div className="flex flex-wrap gap-2">
	                <FilterLink clientId={client.id} label="Todas" params={{ estado: "todas", prioridad: actionPriorityFilter }} active={actionStatusFilter === "todas"} />
	                <FilterLink clientId={client.id} label="Pendientes" params={{ estado: "pendiente", prioridad: actionPriorityFilter }} active={actionStatusFilter === "pendiente"} />
	                <FilterLink clientId={client.id} label="En curso" params={{ estado: "en_curso", prioridad: actionPriorityFilter }} active={actionStatusFilter === "en_curso"} />
	                <FilterLink clientId={client.id} label="Completadas" params={{ estado: "completada", prioridad: actionPriorityFilter }} active={actionStatusFilter === "completada"} />
	                <FilterLink clientId={client.id} label="Todas prioridades" params={{ estado: actionStatusFilter, prioridad: "todas" }} active={actionPriorityFilter === "todas"} />
	                <FilterLink clientId={client.id} label="Urgentes" params={{ estado: actionStatusFilter, prioridad: "urgente" }} active={actionPriorityFilter === "urgente"} />
	                <FilterLink clientId={client.id} label="Altas" params={{ estado: actionStatusFilter, prioridad: "alta" }} active={actionPriorityFilter === "alta"} />
	                <FilterLink clientId={client.id} label="Medias" params={{ estado: actionStatusFilter, prioridad: "media" }} active={actionPriorityFilter === "media"} />
	              </div>
	            </div>
            <ActionList actions={filteredActions} allowComplete />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={tone === "success" ? "rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]" : "rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]"}>
      {text}
    </div>
  );
}

function FilterLink({
  clientId,
  label,
  params,
  active
}: {
  clientId: string;
  label: string;
  params: { estado: string; prioridad: string };
  active: boolean;
}) {
  return (
    <Link
      href={`/operator/clients/${clientId}?tab=acciones&estado=${params.estado}&prioridad=${params.prioridad}`}
      className={`rounded-component border px-3 py-2 text-sm font-semibold ${active ? "border-brand-purple bg-brand-light text-brand-dark" : "border-black/10 bg-white text-zinc-600"}`}
    >
      {label}
    </Link>
  );
}

function PeriodNav({ clientId, tab, period }: { clientId: string; tab: string; period: 3 | 6 | 12 }) {
  return (
    <div className="flex rounded-component border border-black/10 p-1 text-sm">
      {[3, 6, 12].map((months) => (
        <Link
          key={months}
          href={`/operator/clients/${clientId}?tab=${tab}&period=${months}`}
          className={`rounded-[6px] px-3 py-1 font-semibold ${period === months ? "bg-brand-light text-brand-dark" : "text-zinc-500"}`}
        >
          {months}m
        </Link>
      ))}
    </div>
  );
}

function Metric({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="rounded-card border border-black/10 p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="mt-2">
        <ScoreBadge estado={getEstado(score)} />
      </div>
    </div>
  );
}
