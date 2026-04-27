import Link from "next/link";
import { AlertBanner } from "@/components/alerts/alert-banner";
import { CompanyCard } from "@/components/company/company-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getInternalDashboardCompanies } from "@/lib/data-v2/dashboard-internal";

export default async function InternalDashboardPage() {
  const dashboard = await getInternalDashboardCompanies();

  if (!dashboard.success) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error cargando dashboard interno. Reintenta en unos minutos.
        </div>
      </main>
    );
  }

  if (!dashboard.data) {
    return (
      <main className="p-4 md:p-6">
        <LoadingSkeleton variant="company-table" rows={8} />
      </main>
    );
  }

  const rows = [...dashboard.data].sort((a, b) => {
    const scoreA = a.latestHealth?.score_global ?? -1;
    const scoreB = b.latestHealth?.score_global ?? -1;
    return scoreA - scoreB;
  });

  const bannerAlerts = rows
    .filter((row) => row.urgentAlertsPending > 0)
    .slice(0, 3)
    .map((row) => ({
      client_name: row.company.name,
      client_id: row.company.id,
      message: `${row.urgentAlertsPending} alertas urgentes pendientes`,
      priority: "urgente" as const
    }));

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Dashboard interno</h1>
        <p className="text-sm text-[#6B6B6B]">Gestion de cartera por prioridad operativa.</p>
      </header>

      <section id="alertas">
        <AlertBanner alerts={bannerAlerts} />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 p-4 border-b border-[#E8E8E2] text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">
          <p>Company</p>
          <p>Plan</p>
          <p>Score</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState context="clientes" />
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {rows.map((row) => (
              <CompanyCard
                key={row.company.id}
                id={row.company.id}
                name={row.company.name}
                plan={row.company.plan}
                score={row.latestHealth?.score_global ?? null}
                estado={row.latestHealth?.estado_global ?? "Sin diagnostico"}
                urgentAlerts={row.urgentAlertsPending}
                responsible="Asignado"
                href={`/internal/clients/${row.company.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <Link href="/internal/clients" className="inline-flex bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
        Ver cartera completa →
      </Link>
    </main>
  );
}
