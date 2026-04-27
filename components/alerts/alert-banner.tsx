import Link from "next/link";

export type AlertBannerProps = {
  alerts: Array<{
    client_name: string;
    client_id: string;
    message: string;
    priority: "urgente" | "alta";
  }>;
  loading?: boolean;
  error?: string | null;
};

export function AlertBanner({ alerts, loading = false, error = null }: AlertBannerProps) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-gray-200 animate-pulse" />;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar alertas</div>;
  }

  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, 3);
  const allUrgent = alerts.every((alert) => alert.priority === "urgente");
  const containerClass = allUrgent ? "bg-red-600 text-white rounded-xl p-4" : "bg-orange-500 text-white rounded-xl p-4";
  const title = allUrgent ? `${alerts.length} alertas urgentes requieren accion hoy` : `${alerts.length} alertas altas para revisar hoy`;

  return (
    <section className={containerClass}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse mr-2" />
          {title}
        </h2>
        <Link href="/ops/alerts" className="text-white font-semibold underline-offset-2 hover:underline">
          Ver todas →
        </Link>
      </header>

      <ul className="mt-3 space-y-2">
        {visible.map((alert) => (
          <li key={`${alert.client_id}-${alert.message}`} className="text-sm">
            <Link href={`/internal/clients/${alert.client_id}`} className="block">
              <p className="font-semibold">{alert.client_name}</p>
              <p>{alert.message}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
