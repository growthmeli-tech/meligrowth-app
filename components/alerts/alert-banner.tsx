import Link from "next/link";
import type { AlertPriority } from "@/lib/types/enums";

export type AlertBannerProps = {
  alerts: Array<{
    client_name: string;
    client_id: string;
    message: string;
    priority: AlertPriority;
  }>;
  /** `undefined`: enlace a /internal/alerts. `null`: sin CTA listado (p. ej. brand). */
  alertsHref?: string | null;
  /** `false`: las alertas se muestran sin link a ficha interna (vista brand). */
  linkAlertItems?: boolean;
  loading?: boolean;
  error?: string | null;
};

const PRIORITY_RANK: Record<AlertPriority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3
};

function worstAlertPriority(alerts: AlertBannerProps["alerts"]): AlertPriority {
  return alerts.reduce(
    (worst, alert) => (PRIORITY_RANK[alert.priority] < PRIORITY_RANK[worst] ? alert.priority : worst),
    alerts[0].priority
  );
}

export function AlertBanner({
  alerts,
  alertsHref,
  linkAlertItems = true,
  loading = false,
  error = null
}: AlertBannerProps) {
  if (loading) {
    return <div className="h-20 rounded-xl bg-gray-200 animate-pulse" />;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar alertas</div>;
  }

  if (alerts.length === 0) return null;

  const resolvedHref = alertsHref === undefined ? "/internal/alerts" : alertsHref;
  const visible = alerts.slice(0, 3);
  const worst = worstAlertPriority(alerts);
  const urgentCount = alerts.filter((a) => a.priority === "urgente").length;
  const onlyLower = worst === "media" || worst === "baja";

  const containerClass = onlyLower
    ? "rounded-xl border border-[#E8E8E2] bg-[#F9F9F6] p-4 text-[#1A1A1A]"
    : worst === "urgente"
      ? "bg-red-600 text-white rounded-xl p-4"
      : "bg-orange-500 text-white rounded-xl p-4";

  const title = onlyLower
    ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"} de seguimiento`
    : worst === "urgente" && urgentCount === alerts.length
      ? `${alerts.length} alertas urgentes requieren accion hoy`
      : worst === "urgente"
        ? `${alerts.length} alertas activas — incluye ${urgentCount} urgente${urgentCount === 1 ? "" : "s"}`
        : `${alerts.length} alerta${alerts.length === 1 ? "" : "s"} que requieren atencion`;

  const linkClass = onlyLower ? "text-[#1A1A1A] font-semibold underline-offset-2 hover:underline" : "text-white font-semibold underline-offset-2 hover:underline";
  const itemLinkClass = onlyLower ? "text-[#1A1A1A] hover:opacity-80" : "text-white hover:opacity-95";

  return (
    <section className={containerClass}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {!onlyLower && worst === "urgente" ? (
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse mr-2" />
          ) : null}
          {title}
        </h2>
        {resolvedHref ? (
          <Link href={resolvedHref} className={linkClass}>
            Ver todas →
          </Link>
        ) : (
          <span className={onlyLower ? "text-xs text-[#6B6B6B]" : "text-xs text-white/90"}>Coordiná con tu equipo operativo</span>
        )}
      </header>

      <ul className="mt-3 space-y-2">
        {visible.map((alert) => (
          <li key={`${alert.client_id}-${alert.message}-${alert.priority}`} className="text-sm">
            {linkAlertItems ? (
              <Link href={`/internal/clients/${alert.client_id}`} className={`block ${itemLinkClass}`}>
                <p className="font-semibold">{alert.client_name}</p>
                <p>{alert.message}</p>
              </Link>
            ) : (
              <div className={onlyLower ? "text-[#1A1A1A]" : "text-white"}>
                <p className="font-semibold">{alert.client_name}</p>
                <p>{alert.message}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
