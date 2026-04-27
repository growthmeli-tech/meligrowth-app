import { CheckCircle2, CircleDashed } from "lucide-react";
import { completeClientAction } from "@/app/(internal)/internal/clients/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { blockLabels, priorityLabels } from "@/lib/theme";
import type { Action } from "@/lib/types";

export function ActionList({
  actions,
  clientLanguage = false,
  allowComplete = false
}: {
  actions: Action[];
  clientLanguage?: boolean;
  allowComplete?: boolean;
}) {
  if (actions.length === 0) {
    return <div className="rounded-card border border-black/10 bg-white p-6 text-sm text-zinc-500">No hay acciones abiertas para este filtro.</div>;
  }

  return (
    <div className="divide-y divide-black/10 rounded-card border border-black/10 bg-white">
      {actions.map((action) => (
        <div key={action.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            {action.estado === "completada" ? <CheckCircle2 className="mt-1 h-5 w-5 text-[#639922]" /> : <CircleDashed className="mt-1 h-5 w-5 text-brand-purple" />}
            <div>
              <div className="font-semibold text-zinc-950">{clientLanguage ? action.titulo.replace("ACOS", "Publicidad") : action.titulo}</div>
              <div className="mt-1 text-sm text-zinc-600">{action.descripcion}</div>
              <div className="mt-2 text-xs text-zinc-500">
                Responsable: {action.responsable} · Vence: {new Date(action.dueDate).toLocaleDateString("es-AR")}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{blockLabels[action.bloque]}</Badge>
            <Badge className={action.prioridad === "urgente" ? "border-[#E24B4A]/30 bg-[#FCEBEB] text-[#791F1F]" : "bg-brand-light text-brand-dark"}>
              {priorityLabels[action.prioridad]}
            </Badge>
            <Badge className={action.estado === "completada" ? "bg-[#EAF3DE] text-[#27500A]" : "bg-white text-zinc-600"}>
              {action.estado === "en_curso" ? "En curso" : action.estado === "completada" ? "Completada" : "Pendiente"}
            </Badge>
            {allowComplete && action.estado !== "completada" ? (
              <form action={completeClientAction.bind(null, action.clientId, action.id) as unknown as (formData: FormData) => Promise<void>}>
                <Button variant="ghost" type="submit">
                  <CheckCircle2 className="h-4 w-4" />
                  Completar
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
