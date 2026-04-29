import Link from "next/link";
import { PriorityList } from "@/components/ops/priority-list";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getLatestIngestionRunByAccount } from "@/lib/data-v2/ingestion-runs";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { listTasksByAccount } from "@/lib/data-v2/tasks";
import { getCatalogHealthSummary } from "@/lib/data-v2/unified-catalog";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { getOperationalPriorityCopy } from "@/lib/ops/copy";
import { countPricingRiskAlerts } from "@/lib/pricing/pricing-sku-computed";
import { getScoreLabel } from "@/lib/utils/scores";

export default async function OpsDashboardPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const [healthResult, alertsResult, pendingTasks, inProgressTasks, ingestionResult, pricingSkusResult, catalogHealthResult] =
    await Promise.all([
      getLatestAccountHealthByAccount(accountResult.data.id),
      listAlertsByAccount(accountResult.data.id, { audience: "operator", includeResolved: false, limit: 10 }),
      listTasksByAccount(accountResult.data.id, { status: "pendiente" }),
      listTasksByAccount(accountResult.data.id, { status: "en_curso" }),
      getLatestIngestionRunByAccount(accountResult.data.id),
      listPricingSkus(accountResult.data.id),
      getCatalogHealthSummary(accountResult.data.id)
    ]);

  if (!healthResult.success || !healthResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const alerts = alertsResult.success ? [...alertsResult.data].sort((a, b) => priorityOrder(a.prioridad) - priorityOrder(b.prioridad)) : [];
  const priorities = alerts.slice(0, 3).map((alert) => {
    const copy = getOperationalPriorityCopy(alert);
    return {
      id: alert.id,
      title: copy.title,
      subtitle: copy.subtitle,
      priority: copy.priority,
      href: `/ops/blocks/${copy.block}`
    };
  });

  const health = healthResult.data;
  const pendingCount = pendingTasks.success ? pendingTasks.data.length : 0;
  const inProgressCount = inProgressTasks.success ? inProgressTasks.data.length : 0;
  const urgentCount = alerts.filter((a) => a.prioridad === "urgente").length;
  const altaCount = alerts.filter((a) => a.prioridad === "alta").length;
  const snapshotLabel = health.snapshot_date
    ? new Date(health.snapshot_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const ingestion = ingestionResult.success ? ingestionResult.data : null;
  const ingestionHint =
    ingestion && ingestion.status !== "success"
      ? `Última ingesta: ${ingestionStatusPhrase(ingestion.status)}`
      : ingestion
        ? "Última ingesta: OK."
        : null;

  const pricingRiskCount =
    pricingSkusResult.success && health
      ? countPricingRiskAlerts(health.id, accountResult.data.id, pricingSkusResult.data)
      : 0;

  const catalogHealth =
    catalogHealthResult.success && catalogHealthResult.data.totalPublications > 0 ? catalogHealthResult.data : null;

  return (
    <main className="space-y-4">
      {urgentCount > 0 ? (
        <Link
          href="/ops/alerts"
          className="flex items-center justify-between gap-3 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
        >
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-white animate-pulse" />
            {`${urgentCount} alerta${urgentCount === 1 ? "" : "s"} urgente${urgentCount === 1 ? "" : "s"} — acción hoy`}
          </span>
          <span className="shrink-0 underline-offset-2">Ver →</span>
        </Link>
      ) : altaCount > 0 ? (
        <Link
          href="/ops/alerts"
          className="flex items-center justify-between gap-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
        >
          <span>{`${altaCount} alerta${altaCount === 1 ? "" : "s"} alta${altaCount === 1 ? "" : "s"} para revisar`}</span>
          <span className="shrink-0 underline-offset-2">Ver →</span>
        </Link>
      ) : null}

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <PriorityList items={priorities} empty={priorities.length === 0} />
        {alerts.length > 3 ? (
          <Link href="/ops/alerts" className="mt-3 inline-flex text-sm font-semibold text-[#1A1A1A]">
            Ver todas las alertas →
          </Link>
        ) : null}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Estado de cuenta</p>
        <p className="mt-1 text-xs text-[#6B6B6B]">
          {snapshotLabel ? `Diagnóstico al ${snapshotLabel}` : "Sin fecha de snapshot"}
          {ingestionHint ? ` · ${ingestionHint}` : ""}
        </p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-4xl font-black text-[#1A1A1A]">{Math.round(Number(health.score_global ?? 0))}</p>
          <p className="pb-1 text-sm font-semibold text-[#6B6B6B]">{getScoreLabel(Number(health.score_global ?? 0))}</p>
        </div>
        <div className="mt-3">
          <BlockScoresRow
            interactive
            linkBasePath="/ops/blocks"
            scores={{
              salud: Number(health.score_salud ?? 0),
              publicaciones: Number(health.score_publicaciones ?? 0),
              ads: health.score_ads === null ? null : Number(health.score_ads),
              logistica: Number(health.score_logistica ?? 0),
              stock: Number(health.score_stock ?? 0)
            }}
          />
        </div>
      </section>

      {pricingRiskCount > 0 ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <Link href="/ops/pricing" className="flex items-center justify-between gap-2 text-sm font-semibold text-amber-950">
            <span>
              {pricingRiskCount} SKU{pricingRiskCount === 1 ? "" : "s"} con riesgo de margen
            </span>
            <span className="shrink-0 underline-offset-2">Ver motor de precios →</span>
          </Link>
        </section>
      ) : null}

      {catalogHealth ? (
        <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Catálogo</p>
          <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
            {catalogHealth.activePublications} publicaciones activas · {catalogHealth.sinStock} sin stock · {catalogHealth.sinCosto}{" "}
            sin costo
            {catalogHealth.precioDesviado > 0 ? ` · ${catalogHealth.precioDesviado} precio desviado` : ""}
          </p>
          <Link href="/ops/catalog" className="mt-3 inline-flex text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
            Ver catálogo →
          </Link>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Tareas pendientes</p>
          <Link href="/ops/tasks" className="rounded-lg bg-[#FFD600] px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
            + Nueva
          </Link>
        </div>
        <p className="mt-2 text-sm font-medium text-[#1A1A1A]">
          <Link href="/ops/tasks" className="font-semibold text-[#1A1A1A] underline underline-offset-2">
            Ver tablero de tareas
          </Link>
          {` · ${pendingCount} pendientes · ${inProgressCount} en curso`}
        </p>
      </section>
    </main>
  );
}

function priorityOrder(priority: "urgente" | "alta" | "media" | "baja") {
  if (priority === "urgente") return 0;
  if (priority === "alta") return 1;
  if (priority === "media") return 2;
  return 3;
}

function ingestionStatusPhrase(status: "pending" | "running" | "success" | "error") {
  if (status === "error") return "fallida · revisá fuentes o credenciales.";
  if (status === "running" || status === "pending") return "en curso o incompleta.";
  return "revisá el estado.";
}
