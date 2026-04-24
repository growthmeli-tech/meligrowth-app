import Link from "next/link";
import { AlertTriangle, Activity, BellRing, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ClientCard } from "@/components/client-card/client-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getClientOnboardingStatus, getOperatorDashboardData, getUnreadNotificationCount, isPlaceholderDiagnostic } from "@/lib/data";
import { getEstado } from "@/lib/scoring";
import { daysSince } from "@/lib/utils";
import type { Estado, OnboardingStatus, Plan } from "@/lib/types";

function isPlan(value: string | undefined): value is Plan {
  return value === "starter" || value === "growth" || value === "scale";
}

function isEstado(value: string | undefined): value is Estado {
  return value === "platinum" || value === "solido" || value === "desarrollo" || value === "riesgo" || value === "critico";
}

function isEstadoFilter(value: string | undefined): value is Estado | "sin_diagnostico" {
  return isEstado(value) || value === "sin_diagnostico";
}

function isOnboardingFilter(value: string | undefined): value is OnboardingStatus {
  return value === "sin_acceso" || value === "sin_diagnostico" || value === "esperando_plantillas" || value === "operativa";
}

export default async function OperatorDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; operator?: string; plan?: string; estado?: string; onboarding?: string; sort?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const q = (resolvedSearchParams.q ?? "").trim().toLowerCase();
  const operatorFilter = resolvedSearchParams.operator ?? "todos";
  const plan = isPlan(resolvedSearchParams.plan) ? resolvedSearchParams.plan : "todos";
  const estado = isEstadoFilter(resolvedSearchParams.estado) ? resolvedSearchParams.estado : "todos";
  const onboarding = isOnboardingFilter(resolvedSearchParams.onboarding) ? resolvedSearchParams.onboarding : "todos";
  const sort = resolvedSearchParams.sort === "updated" ? "updated" : "score";
  const allBundles = await getOperatorDashboardData();
  const operatorOptions = Array.from(
    new Map(
      allBundles
        .filter((item) => item.operator)
        .map((item) => [item.operator!.id, item.operator!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  const bundles = allBundles
    .filter((item) => (q ? item.client.name.toLowerCase().includes(q) || item.client.meliSellerId.includes(q) : true))
    .filter((item) => (operatorFilter === "todos" ? true : item.client.operatorId === operatorFilter))
    .filter((item) => (plan === "todos" ? true : item.client.plan === plan))
    .filter((item) => {
      if (onboarding === "todos") return true;
      return getClientOnboardingStatus({
        client: item.client,
        diagnostic: item.diagnostic,
        files: item.filesCount > 0 ? [{ id: "count", clientId: item.client.id, tipo: "otro", filename: "", sizeBytes: 0, procesado: false, createdAt: item.client.lastUpdatedAt }] : []
      }) === onboarding;
    })
    .filter((item) => {
      if (estado === "todos") return true;
      if (estado === "sin_diagnostico") return isPlaceholderDiagnostic(item.diagnostic);
      return !isPlaceholderDiagnostic(item.diagnostic) && getEstado(item.diagnostic.scoreGlobal) === estado;
    })
    .sort((a, b) => {
      if (sort === "updated") return new Date(a.client.lastUpdatedAt).getTime() - new Date(b.client.lastUpdatedAt).getTime();
      if (isPlaceholderDiagnostic(a.diagnostic) && !isPlaceholderDiagnostic(b.diagnostic)) return -1;
      if (!isPlaceholderDiagnostic(a.diagnostic) && isPlaceholderDiagnostic(b.diagnostic)) return 1;
      return a.diagnostic.scoreGlobal - b.diagnostic.scoreGlobal;
    });
  const activeAlerts = await getUnreadNotificationCount();

  const diagnosedBundles = bundles.filter((item) => !isPlaceholderDiagnostic(item.diagnostic));
  const average = diagnosedBundles.length ? Math.round(diagnosedBundles.reduce((sum, item) => sum + item.diagnostic.scoreGlobal, 0) / diagnosedBundles.length) : 0;
  const critical = diagnosedBundles.filter((item) => getEstado(item.diagnostic.scoreGlobal) === "critico").length;
  const stale = bundles.filter((item) => isPlaceholderDiagnostic(item.diagnostic) || daysSince(item.client.lastUpdatedAt) > 7).length;
  const withoutDiagnostic = bundles.length - diagnosedBundles.length;

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-normal text-zinc-950">Cartera de clientes</h1>
            <p className="mt-2 text-zinc-600">Priorizá cuentas por riesgo, score y antigüedad del diagnóstico.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/operator/clients/new">
              <Button>Nuevo cliente</Button>
            </Link>
          </div>
        </div>

        <form className="grid gap-3 rounded-card border border-black/10 bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Buscar cliente o Seller ID</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input className="focus-ring h-10 w-full rounded-component border border-black/10 pl-9 pr-3 text-sm" name="q" placeholder="Buscar cliente o Seller ID" defaultValue={resolvedSearchParams.q ?? ""} />
          </label>
          <label>
            <span className="sr-only">Operador asignado</span>
            <select className="focus-ring h-10 w-full rounded-component border border-black/10 bg-white px-3 text-sm" name="operator" defaultValue={operatorFilter}>
              <option value="todos">Todos los operadores</option>
              {operatorOptions.map((operator) => (
                <option key={operator.id} value={operator.id}>{operator.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Plan</span>
            <select className="focus-ring h-10 w-full rounded-component border border-black/10 bg-white px-3 text-sm" name="plan" defaultValue={plan}>
              <option value="todos">Todos los planes</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="scale">Scale</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Estado</span>
            <select className="focus-ring h-10 w-full rounded-component border border-black/10 bg-white px-3 text-sm" name="estado" defaultValue={estado}>
              <option value="todos">Todos los estados</option>
              <option value="critico">Crítico</option>
              <option value="riesgo">En riesgo</option>
              <option value="desarrollo">En desarrollo</option>
              <option value="solido">Sólido</option>
              <option value="platinum">Platinum</option>
              <option value="sin_diagnostico">Sin diagnóstico</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Onboarding</span>
            <select className="focus-ring h-10 w-full rounded-component border border-black/10 bg-white px-3 text-sm" name="onboarding" defaultValue={onboarding}>
              <option value="todos">Todo onboarding</option>
              <option value="sin_acceso">Sin acceso</option>
              <option value="sin_diagnostico">Sin diagnóstico</option>
              <option value="esperando_plantillas">Esperando plantillas</option>
              <option value="operativa">Operativa</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Orden</span>
            <select className="focus-ring h-10 w-full rounded-component border border-black/10 bg-white px-3 text-sm" name="sort" defaultValue={sort}>
              <option value="score">Score ascendente</option>
              <option value="updated">Última actualización</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Aplicar</Button>
        </form>

        <section className="grid gap-4 md:grid-cols-5">
          <Card>
            <Activity className="h-5 w-5 text-brand-purple" />
            <div className="mt-4 text-3xl font-bold">{average}</div>
            <div className="text-sm text-zinc-500">Score promedio cartera</div>
          </Card>
          <Card>
            <AlertTriangle className="h-5 w-5 text-[#E24B4A]" />
            <div className="mt-4 text-3xl font-bold">{critical}</div>
            <div className="text-sm text-zinc-500">Cuentas críticas</div>
            <Link href="/operator/dashboard?estado=critico" className="mt-3 inline-flex text-xs font-semibold text-brand-dark">Ver críticas</Link>
          </Card>
          <Card>
            <BellRing className="h-5 w-5 text-[#BA7517]" />
            <div className="mt-4 text-3xl font-bold">{activeAlerts}</div>
            <div className="text-sm text-zinc-500">Alertas activas</div>
            <Link href="/operator/notifications?estado=sin_leer&tipo=todas" className="mt-3 inline-flex text-xs font-semibold text-brand-dark">Ver alertas</Link>
          </Card>
          <Card>
            <BellRing className="h-5 w-5 text-[#D85A30]" />
            <div className="mt-4 text-3xl font-bold">{stale}</div>
            <div className="text-sm text-zinc-500">Sin actualizar en +7 días</div>
          </Card>
          <Card>
            <AlertTriangle className="h-5 w-5 text-[#BA7517]" />
            <div className="mt-4 text-3xl font-bold">{withoutDiagnostic}</div>
            <div className="text-sm text-zinc-500">Sin diagnóstico inicial</div>
            <Link href="/operator/dashboard?estado=sin_diagnostico" className="mt-3 inline-flex text-xs font-semibold text-brand-dark">Ver pendientes</Link>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bundles.length > 0 ? bundles.map((bundle) => (
            <ClientCard
              key={bundle.client.id}
              client={bundle.client}
              diagnostic={bundle.diagnostic}
              operator={bundle.operator}
              onboardingStatus={getClientOnboardingStatus({
                client: bundle.client,
                diagnostic: bundle.diagnostic,
                files: bundle.filesCount > 0 ? [{ id: "count", clientId: bundle.client.id, tipo: "otro", filename: "", sizeBytes: 0, procesado: false, createdAt: bundle.client.lastUpdatedAt }] : []
              })}
            />
          )) : <div className="rounded-card border border-black/10 bg-white p-6 text-sm text-zinc-500 md:col-span-2 xl:col-span-3">No hay clientes para esos filtros.</div>}
        </section>
      </div>
    </AppShell>
  );
}
