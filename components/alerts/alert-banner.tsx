import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type AlertBannerProps = {
  alerts: Array<{
    client_name: string;
    client_id: string;
    message: string;
    priority: "urgente" | "alta";
  }>;
};

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, 3);
  const urgentCount = alerts.filter((alert) => alert.priority === "urgente").length;
  const highCount = alerts.filter((alert) => alert.priority === "alta").length;
  const hasCritical = urgentCount > 0;

  return (
    <section className={`rounded-xl border p-4 ${hasCritical ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${hasCritical ? "text-red-700" : "text-orange-700"} ${hasCritical ? "animate-pulse" : ""}`} />
          <h2 className={`text-sm font-bold uppercase tracking-wide ${hasCritical ? "text-red-800" : "text-orange-800"}`}>
            {urgentCount} urgentes · {highCount} altas
          </h2>
        </div>
        <Link href="/operator/notifications?estado=sin_leer&tipo=todas" className="text-sm font-semibold text-brand-dark">
          Ver alertas
        </Link>
      </header>
      <ul className="mt-3 space-y-2">
        {visible.map((alert) => (
          <li key={`${alert.client_id}-${alert.message}`} className="rounded-lg border border-black/10 bg-white p-3 text-sm">
            <Link href={`/operator/clients/${alert.client_id}`} className="block">
              <p className="font-semibold text-zinc-900">{alert.client_name}</p>
              <p className="mt-1 text-zinc-600">{alert.message}</p>
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > 3 ? (
        <p className="mt-2 text-xs font-medium text-zinc-600">Mostrando 3 de {alerts.length} alertas prioritarias.</p>
      ) : null}
    </section>
  );
}
