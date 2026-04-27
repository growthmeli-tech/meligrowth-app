import { resolveAlert } from "@/app/(internal)/internal/alerts/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { listInternalAlerts } from "@/lib/data-v2/alerts";

type AlertsSearchParams = {
  prioridad?: "urgente" | "alta" | "media" | "baja" | "all";
  company?: string;
  estado?: "pendiente" | "resuelta" | "all";
};

export default async function InternalAlertsPage({
  searchParams
}: {
  searchParams?: Promise<AlertsSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const prioridad = resolvedSearchParams.prioridad ?? "all";
  const companyId = resolvedSearchParams.company ?? "all";
  const estado = resolvedSearchParams.estado ?? "pendiente";

  const alertsResult = await listInternalAlerts({
    priority: prioridad,
    companyId,
    resolution: estado
  });

  if (!alertsResult.success) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No pudimos cargar alertas ahora. Reintentá en unos minutos.
        </div>
      </main>
    );
  }

  const alerts = alertsResult.data;
  const companyOptions = Array.from(new Map(alerts.map((alert) => [alert.company_id, alert.company_name])).entries()).map(
    ([id, name]) => ({ id, name })
  );

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Alertas</p>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Centro de alertas internas</h1>
        <p className="text-sm text-[#6B6B6B]">Priorizá incidencias urgentes y resolvé seguimiento operativo por cuenta.</p>
      </header>

      <form className="rounded-xl border border-[#E8E8E2] bg-white p-4 grid gap-3 md:grid-cols-4">
        <FilterSelect
          label="Prioridad"
          name="prioridad"
          value={prioridad}
          options={[
            { value: "all", label: "Todas" },
            { value: "urgente", label: "Urgente" },
            { value: "alta", label: "Alta" },
            { value: "media", label: "Media" },
            { value: "baja", label: "Baja" }
          ]}
        />
        <FilterSelect
          label="Company"
          name="company"
          value={companyId}
          options={[
            { value: "all", label: "Todas" },
            ...companyOptions.map((company) => ({ value: company.id, label: company.name }))
          ]}
        />
        <FilterSelect
          label="Estado"
          name="estado"
          value={estado}
          options={[
            { value: "pendiente", label: "Pendiente" },
            { value: "resuelta", label: "Resuelta" },
            { value: "all", label: "Todos" }
          ]}
        />
        <div className="flex items-end">
          <button className="h-10 rounded-lg bg-[#FFD600] px-4 text-sm font-semibold text-[#1A1A1A]">Aplicar filtros</button>
        </div>
      </form>

      {alerts.length === 0 ? (
        <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <EmptyState context="recomendaciones" />
          <p className="-mt-6 text-center text-sm font-semibold text-[#1A1A1A]">No hay alertas activas. Tu cartera está al día ✅</p>
        </section>
      ) : (
        <section className="space-y-3">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-xl border border-[#E8E8E2] bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PriorityBadge prioridad={alert.prioridad} />
                  <p className="text-sm font-semibold text-[#1A1A1A]">{alert.company_name}</p>
                </div>
                <p className="text-xs text-[#6B6B6B]">{new Date(alert.created_at).toLocaleDateString("es-AR")}</p>
              </div>

              <div>
                <h2 className="text-sm font-bold text-[#1A1A1A]">{alert.titulo}</h2>
                <p className="mt-1 text-sm text-[#6B6B6B]">{alert.descripcion ?? "Sin descripción adicional"}</p>
              </div>

              <div className="rounded-lg border border-[#E8E8E2] bg-[#F9F9F6] p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Acción concreta</p>
                <p className="mt-1 text-sm text-[#1A1A1A]">{alert.accion_concreta ?? "Revisar la cuenta y definir plan de acción."}</p>
              </div>

              <div className="flex justify-end">
                {alert.resuelta ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Resuelta</span>
                ) : (
                  <form action={resolveAlert}>
                    <input type="hidden" name="alert_id" value={alert.id} />
                    <button className="rounded-lg border border-[#E8E8E2] px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F5F0]">
                      Marcar resuelta
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function PriorityBadge({ prioridad }: { prioridad: "urgente" | "alta" | "media" | "baja" }) {
  const tone: Record<typeof prioridad, string> = {
    urgente: "bg-red-100 text-red-700 border-red-200",
    alta: "bg-orange-100 text-orange-700 border-orange-200",
    media: "bg-amber-100 text-amber-700 border-amber-200",
    baja: "bg-blue-100 text-blue-700 border-blue-200"
  };

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${tone[prioridad]}`}>{prioridad.toUpperCase()}</span>;
}

function FilterSelect({
  label,
  name,
  value,
  options
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-lg border border-[#E8E8E2] bg-white px-3 text-sm text-[#1A1A1A]">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
