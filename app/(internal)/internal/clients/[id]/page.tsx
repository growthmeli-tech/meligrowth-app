import Link from "next/link";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { BlockScoresRow } from "@/components/score/block-scores-row";
import { ScoreDisplay } from "@/components/score/score-display";
import { EmptyState } from "@/components/ui/empty-state";
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";
import { getAccountHealthWithDelta, listAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import type { DiagnosticReportData } from "@/lib/reports/generate-diagnostic-report";

export default async function InternalClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ml_connected?: string; ml_error?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const companyResult = await getCompanyById(id);

  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta cuenta</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  let account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!account) {
    const fallbackAccountsResult = await listMlAccountsByCompany(id);
    account = fallbackAccountsResult.success ? (fallbackAccountsResult.data[0] ?? null) : null;
  }

  const healthResult = account ? await getAccountHealthWithDelta(account.id) : null;
  const health = healthResult?.success && healthResult.data ? healthResult.data.current : null;
  const delta = healthResult?.success && healthResult.data ? healthResult.data.delta : null;
  const needsMlConnection = !account?.seller_id;
  const hasConnectedBanner = resolvedSearchParams.ml_connected === "true";
  const hasErrorBanner = typeof resolvedSearchParams.ml_error === "string" && resolvedSearchParams.ml_error.length > 0;
  const reportData = account && health ? await buildReportData(companyResult.data, account.id, health) : null;

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-[#6B6B6B]">Cartera interna</p>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{companyResult.data.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/internal/clients/${id}/settings`} className="rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm font-semibold text-[#1A1A1A]">
            {needsMlConnection ? "Conectar ML" : "Configurar ML"}
          </Link>
          <DownloadReportButton reportData={reportData ?? emptyReportData(companyResult.data.name, companyResult.data.plan)} disabled={!reportData} />
          <Link href={`/internal/clients/${id}/diagnostic/new`} className="bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
            Nuevo diagnostico
          </Link>
        </div>
      </header>

      {hasConnectedBanner ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Cuenta ML conectada exitosamente.
        </div>
      ) : null}
      {hasErrorBanner ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          Error al conectar cuenta ML: {resolvedSearchParams.ml_error}
        </div>
      ) : null}

      <nav className="rounded-xl border border-[#E8E8E2] bg-white p-2">
        <ul className="flex flex-wrap gap-2 text-sm font-semibold text-[#1A1A1A]">
          <li>
            <Link href={`/internal/clients/${id}/diagnostic/new`} className="inline-flex rounded-lg px-3 py-2 hover:bg-[#F5F5F0]">
              Diagnostico
            </Link>
          </li>
          <li>
            <Link href={`/internal/clients/${id}`} className="inline-flex rounded-lg bg-[#F5F5F0] px-3 py-2">
              Historial
            </Link>
          </li>
          <li>
            <Link href={`/internal/clients/${id}/files`} className="inline-flex rounded-lg px-3 py-2 hover:bg-[#F5F5F0]">
              Archivos
            </Link>
          </li>
          <li>
            <Link href={`/internal/clients/${id}/settings`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-[#F5F5F0]">
              Configurar ML ⚙️ {needsMlConnection ? <span className="text-orange-500">🟠</span> : null}
            </Link>
          </li>
        </ul>
      </nav>

      {!account ? (
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-700">Esta company todavia no tiene una cuenta ML asociada.</p>
          <Link href={`/internal/clients/${id}/settings`} className="mt-3 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]">
            Ir a configurar conexion ML
          </Link>
        </section>
      ) : null}

      {account && !health ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
            <p className="text-sm text-[#1A1A1A]">
              La cuenta ML {account.account_name ? `(${account.account_name}) ` : ""}esta lista para conectar/sincronizar, pero todavia no tiene diagnosticos.
            </p>
            <Link href={`/internal/clients/${id}/settings`} className="mt-3 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]">
              {needsMlConnection ? "Conectar cuenta de Mercado Libre" : "Revisar conexion ML"}
            </Link>
          </div>
          <EmptyState context="diagnosticos" />
        </section>
      ) : null}

      {account && health ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
            <ScoreDisplay score={health.score_global} delta={delta} size="lg" animated />
            <BlockScoresRow
              scores={{
                salud: Number(health.score_salud ?? 0),
                publicaciones: Number(health.score_publicaciones ?? 0),
                ads: health.score_ads === null ? null : Number(health.score_ads),
                logistica: Number(health.score_logistica ?? 0),
                stock: Number(health.score_stock ?? 0)
              }}
            />
          </div>
          <RecommendationsPanel clientId={id} maxVisible={5} />
        </section>
      ) : null}
    </main>
  );
}

async function buildReportData(
  company: { name: string; plan: string },
  mlAccountId: string,
  health: {
    score_global: number;
    estado_global: string;
    score_salud: number | null;
    score_publicaciones: number | null;
    score_ads: number | null;
    score_logistica: number | null;
    score_stock: number | null;
  }
): Promise<DiagnosticReportData> {
  const [alertsResult, historyResult] = await Promise.all([
    listAlertsByAccount(mlAccountId, { includeResolved: false, limit: 12 }),
    listAccountHealthByAccount(mlAccountId, 6)
  ]);

  const alerts = alertsResult.success ? alertsResult.data : [];
  const sortedAlerts = [...alerts].sort((a, b) => priorityOrder(a.prioridad) - priorityOrder(b.prioridad));
  const top3 = sortedAlerts.slice(0, 3);

  return {
    company_name: company.name,
    plan: company.plan,
    fecha: new Date().toISOString().slice(0, 10),
    score_global: Number(health.score_global ?? 0),
    estado_global: String(health.estado_global ?? "critico"),
    score_salud: Number(health.score_salud ?? 0),
    score_publicaciones: Number(health.score_publicaciones ?? 0),
    score_ads: Number(health.score_ads ?? 0),
    score_logistica: Number(health.score_logistica ?? 0),
    score_stock: Number(health.score_stock ?? 0),
    alertas: top3.map((alert) => ({
      titulo: alert.titulo,
      descripcion: alert.descripcion ?? "Sin detalle adicional.",
      accion_concreta: alert.accion_concreta ?? "Definir plan de acción con el equipo.",
      prioridad: alert.prioridad,
      categoria: alert.categoria
    })),
    recomendaciones_top3: top3.map((alert) => ({
      titulo: alert.titulo,
      accion_concreta: alert.accion_concreta ?? "Definir plan de acción con el equipo.",
      impacto_estimado: "Impacto estimado: mejora directa del score global"
    })),
    historial: historyResult.success
      ? historyResult.data.map((item) => ({
          fecha: item.snapshot_date,
          score_global: Number(item.score_global ?? 0)
        }))
      : undefined
  };
}

function emptyReportData(companyName: string, plan: string): DiagnosticReportData {
  return {
    company_name: companyName,
    plan,
    fecha: new Date().toISOString().slice(0, 10),
    score_global: 0,
    estado_global: "sin_diagnostico",
    score_salud: 0,
    score_publicaciones: 0,
    score_ads: 0,
    score_logistica: 0,
    score_stock: 0,
    alertas: [],
    recomendaciones_top3: []
  };
}

function priorityOrder(priority: "urgente" | "alta" | "media" | "baja") {
  if (priority === "urgente") return 0;
  if (priority === "alta") return 1;
  if (priority === "media") return 2;
  return 3;
}
