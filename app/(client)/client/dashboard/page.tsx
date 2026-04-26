import Link from "next/link";
import { ArrowRight, FileUp, LineChart, PackageCheck, Truck } from "lucide-react";
import { ActionList } from "@/components/actions/action-list";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ClientScoreHero } from "@/components/client/client-score-hero";
import { AppShell } from "@/components/layout/app-shell";
import { ScoreBar } from "@/components/score/score-bar";
import { ScoreBadge } from "@/components/score/score-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getClientDashboardBundle } from "@/lib/data";
import { getDiagnosticWithDelta, getEstadoSimpleParaCliente } from "@/lib/data/diagnostics";
import { clientBlockLabels, estadoLabels } from "@/lib/theme";
import type { BlockKey } from "@/lib/types";
import { formatPct } from "@/lib/utils";

export default async function ClientDashboardPage() {
  const { client, diagnostic, actions } = await getClientDashboardBundle();
  const withDelta = await getDiagnosticWithDelta(client.id);
  const delta = withDelta.success ? withDelta.data.delta : null;
  const simpleState = getEstadoSimpleParaCliente(diagnostic.estadoGlobal);
  const openActions = actions.filter((action) => action.estado !== "completada");
  const visibleActions = openActions.slice(0, 4);
  const summaryByBlock = (Object.entries(diagnostic.scores) as Array<[BlockKey, number]>).map(([key, score]) => ({
    key,
    label: clientBlockLabels[key],
    text: score >= 85 ? "muy bien" : score >= 70 ? "bien" : score >= 55 ? "en proceso" : "requiere atención",
    icon: score >= 70 ? "✅" : score >= 55 ? "⚠️" : "🔴"
  }));

  return (
    <AppShell mode="client">
      <div className="space-y-6">
        <section className="rounded-card border border-black/10 bg-white p-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <BrandLogo className="mb-5 h-16 w-56" />
              <div className="text-sm font-semibold text-brand-dark">{client.name}</div>
              <h1 className="mt-2 text-3xl font-bold text-zinc-950">{simpleState}</h1>
              <p className="mt-2 max-w-2xl text-zinc-600">Este es el resumen de lo que estamos monitoreando y trabajando esta semana para tu cuenta.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/client/metrics">
                  <Button>
                    <LineChart className="h-4 w-4" />
                    Ver métricas
                  </Button>
                </Link>
                <Link href="/client/files">
                  <Button variant="secondary">
                    <FileUp className="h-4 w-4" />
                    Subir archivos
                  </Button>
                </Link>
              </div>
            </div>
            <ClientScoreHero
              score={diagnostic.scoreGlobal}
              delta={delta}
              estado_simple={simpleState}
              mes={new Date(diagnostic.date).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={LineChart} label="Publicidad" value={`${diagnostic.ads.roas.toFixed(1)} ROAS`} />
          <MetricCard icon={PackageCheck} label="Stock disponible" value={`${100 - diagnostic.stock.skus_sin_stock_pct}%`} />
          <MetricCard icon={Truck} label="Entregas a tiempo" value={formatPct(diagnostic.salud.envios_a_tiempo)} />
          <MetricCard icon={PackageCheck} label="Publicaciones listas" value={formatPct(diagnostic.publicaciones.pubs_optimizadas_pct)} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <h2 className="text-lg font-bold">Qué está pasando</h2>
            <div className="mt-5 space-y-5">
              {summaryByBlock.map((item) => (
                <div key={item.key}>
                  <div className="mb-2 flex justify-between gap-2">
                    <span className="font-semibold">
                      {item.icon} {item.label}
                    </span>
                    <span className="text-sm text-zinc-500">{item.text}</span>
                  </div>
                  <ScoreBar score={diagnostic.scores[item.key]} />
                </div>
              ))}
            </div>
          </Card>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Lo que está pasando esta semana</h2>
              <Link href="/client/metrics" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-dark">
                Ver métricas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ActionList actions={visibleActions} clientLanguage />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <Icon className="h-5 w-5 text-brand-purple" />
      <div className="mt-4 text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}
