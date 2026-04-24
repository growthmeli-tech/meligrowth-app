import Link from "next/link";
import { ArrowRight, FileUp, LineChart, PackageCheck, Truck } from "lucide-react";
import { ActionList } from "@/components/actions/action-list";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AppShell } from "@/components/layout/app-shell";
import { ScoreBar } from "@/components/score/score-bar";
import { ScoreBadge } from "@/components/score/score-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getClientDashboardBundle } from "@/lib/data";
import { clientBlockLabels, estadoLabels } from "@/lib/theme";
import type { BlockKey } from "@/lib/types";
import { formatPct } from "@/lib/utils";

export default async function ClientDashboardPage() {
  const { client, diagnostic, actions } = await getClientDashboardBundle();
  const simpleState = diagnostic.scoreGlobal >= 85 ? "Tu cuenta está en buen camino" : diagnostic.scoreGlobal >= 70 ? "Tu cuenta está mejorando" : "Estamos enfocando la semana en estabilizar la cuenta";
  const openActions = actions.filter((action) => action.estado !== "completada");
  const visibleActions = openActions.slice(0, 4);

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
            <div className="rounded-card border border-black/10 p-4 text-center">
              <div className="text-sm text-zinc-500">Estado general</div>
              <div className="mt-3">
                <ScoreBadge estado={diagnostic.estadoGlobal} />
              </div>
              <div className="mt-3 text-xs text-zinc-500">Actualizado {new Date(diagnostic.date).toLocaleDateString("es-AR")}</div>
            </div>
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
            <h2 className="text-lg font-bold">Estado por área</h2>
            <div className="mt-5 space-y-5">
              {(Object.entries(diagnostic.scores) as Array<[BlockKey, number]>).map(([key, score]) => (
                <div key={key}>
                  <div className="mb-2 flex justify-between">
                    <span className="font-semibold">{clientBlockLabels[key]}</span>
                    <span className="text-sm text-zinc-500">{estadoLabels[diagnostic.estadoGlobal]}</span>
                  </div>
                  <ScoreBar score={score} />
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
