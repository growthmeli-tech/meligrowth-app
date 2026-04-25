import Link from "next/link";
import { BellRing, Check, CircleAlert, FileCheck, TrendingDown } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/lib/types";

const icons = {
  archivo_procesado: FileCheck,
  alerta_critica: CircleAlert,
  score_bajo: TrendingDown,
  accion_completada: BellRing,
  reporte_semanal: FileCheck
};

const typeLabels: Record<Notification["tipo"], string> = {
  score_bajo: "Score bajo",
  alerta_critica: "Alerta crítica",
  accion_completada: "Acción completada",
  archivo_procesado: "Archivo",
  reporte_semanal: "Reporte"
};

export function NotificationList({
  notifications,
  basePath,
  statusFilter = "todas",
  typeFilter = "todas"
}: {
  notifications: Notification[];
  basePath: string;
  statusFilter?: string;
  typeFilter?: string;
}) {
  const unread = notifications.filter((notification) => !notification.leida).length;
  const filtered = notifications.filter((notification) => {
    const statusMatches = statusFilter === "sin_leer" ? !notification.leida : statusFilter === "leidas" ? notification.leida : true;
    const typeMatches = typeFilter === "todas" || notification.tipo === typeFilter;
    return statusMatches && typeMatches;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-950">Notificaciones</h1>
          <p className="mt-2 text-zinc-600">{unread} sin leer de {notifications.length} recientes.</p>
        </div>
        <form action={markAllNotificationsRead as unknown as (formData: FormData) => Promise<void>}>
          <Button variant="secondary" type="submit">
            <Check className="h-4 w-4" />
            Marcar todas como leídas
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 rounded-card border border-black/10 bg-white p-3">
        <FilterLink href={`${basePath}?estado=todas&tipo=${typeFilter}`} active={statusFilter === "todas"} label="Todas" />
        <FilterLink href={`${basePath}?estado=sin_leer&tipo=${typeFilter}`} active={statusFilter === "sin_leer"} label="Sin leer" />
        <FilterLink href={`${basePath}?estado=leidas&tipo=${typeFilter}`} active={statusFilter === "leidas"} label="Leídas" />
        <div className="mx-1 hidden h-8 w-px bg-black/10 md:block" />
        <FilterLink href={`${basePath}?estado=${statusFilter}&tipo=todas`} active={typeFilter === "todas"} label="Todos los tipos" />
        <FilterLink href={`${basePath}?estado=${statusFilter}&tipo=alerta_critica`} active={typeFilter === "alerta_critica"} label="Críticas" />
        <FilterLink href={`${basePath}?estado=${statusFilter}&tipo=score_bajo`} active={typeFilter === "score_bajo"} label="Score" />
        <FilterLink href={`${basePath}?estado=${statusFilter}&tipo=archivo_procesado`} active={typeFilter === "archivo_procesado"} label="Archivos" />
      </div>

      <div className="divide-y divide-black/10 rounded-card border border-black/10 bg-white">
        {filtered.length > 0 ? (
          filtered.map((notification) => {
            const Icon = icons[notification.tipo];
            return (
              <div key={notification.id} className={`flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between ${notification.leida ? "bg-white" : "bg-brand-light/60"}`}>
                <div className="flex gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-component ${notification.leida ? "bg-zinc-100 text-zinc-600" : "bg-white text-brand-purple"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-zinc-950">{notification.titulo}</h2>
                      {!notification.leida ? <span className="h-2 w-2 rounded-full bg-[#E24B4A]" aria-label="Sin leer" /> : null}
                      <Badge className="bg-zinc-100 text-zinc-700">{typeLabels[notification.tipo]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{notification.mensaje}</p>
                    <p className="mt-2 text-xs text-zinc-500">{new Date(notification.createdAt).toLocaleString("es-AR")}</p>
                  </div>
                </div>
                {!notification.leida ? (
                  <form action={markNotificationRead.bind(null, notification.id) as unknown as (formData: FormData) => Promise<void>}>
                    <Button variant="ghost" type="submit">
                      <Check className="h-4 w-4" />
                      Leída
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="p-6 text-sm text-zinc-500">No hay notificaciones para este filtro.</div>
        )}
      </div>
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-component border px-3 py-2 text-sm font-semibold ${active ? "border-brand-purple bg-brand-light text-brand-dark" : "border-black/10 bg-white text-zinc-600 hover:bg-brand-light"}`}
    >
      {label}
    </Link>
  );
}
