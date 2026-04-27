"use client";

import { cn } from "@/lib/utils";

export type TaskCardTask = {
  id: string;
  title: string;
  block: string;
  dueDate?: string | null;
  assignee?: string | null;
  status: "pendiente" | "en_curso" | "completada" | "descartada";
};

export type TaskCardProps = {
  task: TaskCardTask;
  onComplete?: (taskId: string) => void;
  onReassign?: (taskId: string) => void;
  onViewDetail?: (taskId: string) => void;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

export function TaskCard({ task, onComplete, onReassign, onViewDetail, loading = false, error = null, empty = false }: TaskCardProps) {
  if (loading) return <div className="h-24 rounded-xl bg-gray-200 animate-pulse" />;

  if (error) {
    return (
      <article className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm text-red-600">No se pudo cargar la tarea</p>
        <button type="button" className="mt-2 text-xs font-semibold text-[#1A1A1A]">
          Reintentar
        </button>
      </article>
    );
  }

  if (empty) {
    return (
      <article className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <p className="text-sm text-[#6B6B6B]">No hay tareas pendientes</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Crear tarea manual
        </button>
      </article>
    );
  }

  const statusClassName = getStatusClassName(task.status);
  const titleClassName = task.status === "descartada" ? "line-through text-gray-400" : "text-[#1A1A1A]";

  return (
    <article className={cn("bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4 hover:shadow-sm transition-shadow duration-150", statusClassName)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-sm font-semibold", titleClassName)}>{task.title}</p>
        <p className="text-xs font-semibold text-[#6B6B6B] uppercase">{task.status.replace("_", " ")}</p>
      </div>
      <p className="mt-1 text-xs text-[#6B6B6B]">{`Bloque: ${task.block} · Vence: ${task.dueDate ?? "Sin fecha"} · ${task.assignee ?? "Sin asignar"}`}</p>
      <div className="mt-3 border-t border-[#E8E8E2] pt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" className="text-xs font-semibold text-[#1A1A1A]" onClick={() => onComplete?.(task.id)}>
          Completar ✓
        </button>
        <button type="button" className="text-xs font-semibold text-[#1A1A1A]" onClick={() => onReassign?.(task.id)}>
          Reasignar
        </button>
        <button type="button" className="text-xs font-semibold text-[#1A1A1A]" onClick={() => onViewDetail?.(task.id)}>
          Ver detalle →
        </button>
      </div>
    </article>
  );
}

function getStatusClassName(status: TaskCardTask["status"]) {
  if (status === "pendiente") return "border-l-4 border-l-amber-400";
  if (status === "en_curso") return "border-l-4 border-l-blue-500";
  if (status === "completada") return "border-l-4 border-l-green-500 opacity-60";
  return "border-l-4 border-l-gray-300";
}
