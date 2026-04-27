import { CompanyCard } from "@/components/company/company-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getInternalDashboardCompanies } from "@/lib/data-v2/dashboard-internal";

export default async function InternalClientsPage() {
  const result = await getInternalDashboardCompanies();

  if (!result.success) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar empresas de cartera</div>
      </main>
    );
  }

  if (!result.data) {
    return (
      <main className="p-4 md:p-6">
        <LoadingSkeleton variant="company-table" rows={5} />
      </main>
    );
  }

  const rows = [...result.data].sort((a, b) => {
    const scoreA = a.latestHealth?.score_global ?? -1;
    const scoreB = b.latestHealth?.score_global ?? -1;
    return scoreA - scoreB;
  });

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Cartera de companies</h1>
        <p className="text-sm text-[#6B6B6B]">Ordenadas por score ascendente (peores primero).</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState context="clientes" />
      ) : (
        <section className="space-y-2">
          {rows.map((row) => (
            <CompanyCard
              key={row.company.id}
              id={row.company.id}
              name={row.company.name}
              plan={row.company.plan}
              score={row.latestHealth?.score_global ?? null}
              delta={null}
              estado={row.latestHealth?.estado_global ?? "Sin diagnostico"}
              urgentAlerts={row.urgentAlertsPending}
              responsible="Asignado"
              href={`/internal/clients/${row.company.id}`}
            />
          ))}
        </section>
      )}
    </main>
  );
}
