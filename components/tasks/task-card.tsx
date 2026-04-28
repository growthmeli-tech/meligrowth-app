"use client";

import { cn } from "@/lib/utils";

export type TaskCardTask = {
  id: string;
  title: string;
  description?: string | null;
  priority: "urgente" | "alta" | "media" | "baja";
  dueDate?: string | null;
  status: "pendiente" | "en_curso" | "completada" | "descartada";
};

export type TaskCardProps = {
  task: TaskCardTask;
  onAdvance?: (taskId: string) => void;
  advancing?: boolean;
};

export function TaskCard({ task, onAdvance, advancing = false }: TaskCardProps) {
  const statusClassName = getStatusClassName(task.status);
  const titleClassName = task.status === "descartada" ? "line-through text-gray-400" : "text-[#1A1A1A]";
  const priorityClassName = getPriorityClassName(task.priority);
  const statusLabel = task.status.replace("_", " ");

  return (
    <article className={cn("bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4 hover:shadow-sm transition-shadow duration-150", statusClassName)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-semibold", titleClassName)}>{task.title}</p>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", priorityClassName)}>{task.priority}</span>
          <p className="text-xs font-semibold uppercase text-[#6B6B6B]">{statusLabel}</p>
        </div>
      </div>
      {task.description ? <p className="mt-2 text-sm text-[#6B6B6B]">{task.description}</p> : null}
      <p className="mt-2 text-xs text-[#6B6B6B]">{`Vence: ${task.dueDate ?? "Sin fecha"}`}</p>
      <div className="mt-3 border-t border-[#E8E8E2] pt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {task.status === "pendiente" ? (
          <button
            type="button"
            className="rounded-lg bg-[#FFD600] px-3 py-2 text-xs font-semibold text-[#1A1A1A] disabled:opacity-70"
            onClick={() => onAdvance?.(task.id)}
            disabled={advancing}
          >
            {advancing ? "Iniciando..." : "Iniciar"}
          </button>
        ) : null}
        {task.status === "en_curso" ? (
          <button
            type="button"
            className="rounded-lg bg-[#FFD600] px-3 py-2 text-xs font-semibold text-[#1A1A1A] disabled:opacity-70"
            onClick={() => onAdvance?.(task.id)}
            disabled={advancing}
          >
            {advancing ? "Completando..." : "Completar"}
          </button>
        ) : null}
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

function getPriorityClassName(priority: TaskCardTask["priority"]) {
  if (priority === "urgente") return "bg-red-100 text-red-700";
  if (priority === "alta") return "bg-orange-100 text-orange-700";
  if (priority === "media") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}
