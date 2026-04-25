import { Plus } from "lucide-react";
import { createClientAction } from "@/app/(operator)/operator/clients/[id]/actions";
import { Button } from "@/components/ui/button";
import { blockLabels, priorityLabels } from "@/lib/theme";
import type { BlockKey, Priority } from "@/lib/types";

const blockOptions = Object.entries(blockLabels) as Array<[BlockKey, string]>;
const priorityOptions = Object.entries(priorityLabels) as Array<[Priority, string]>;

export function ActionForm({ clientId }: { clientId: string }) {
  const action = createClientAction.bind(null, clientId) as unknown as (formData: FormData) => Promise<void>;

  return (
    <form action={action} className="grid gap-4 rounded-card border border-black/10 bg-white p-5 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <h2 className="text-lg font-bold text-zinc-950">Nueva acción</h2>
        <p className="mt-1 text-sm text-zinc-600">Creá tareas operativas para priorizar el trabajo semanal.</p>
      </div>

      <label className="space-y-2 lg:col-span-2">
        <span className="text-sm font-semibold text-zinc-700">Título</span>
        <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="titulo" placeholder="Optimizar top 20 publicaciones" required />
      </label>

      <label className="space-y-2 lg:col-span-2">
        <span className="text-sm font-semibold text-zinc-700">Descripción</span>
        <textarea className="focus-ring min-h-24 w-full rounded-component border border-black/10 p-3" name="descripcion" placeholder="Detalle del trabajo, contexto o criterio de cierre." />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-zinc-700">Bloque</span>
        <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="bloque" defaultValue="publicaciones">
          {blockOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-zinc-700">Prioridad</span>
        <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="prioridad" defaultValue="media">
          {priorityOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-zinc-700">Vencimiento</span>
        <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="due_date" type="date" />
      </label>

      <div className="flex items-end">
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Crear acción
        </Button>
      </div>
    </form>
  );
}
