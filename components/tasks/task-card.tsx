"use client";

import { useEffect, useMemo, useState } from "react";
import { OPS_BLOCKS } from "@/lib/ops/copy";
import { getTaskSteps } from "@/lib/ops/task-steps";
import { cn } from "@/lib/utils";

export type TaskCardTask = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority: "urgente" | "alta" | "media" | "baja";
  dueDate?: string | null;
  status: "pendiente" | "en_curso" | "completada" | "descartada";
  /** Pasos persistidos en DB (Claude); vacío o null usa el fallback local */
  steps?: string[] | null;
};

export type TaskCardProps = {
  task: TaskCardTask;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  advancingStart?: boolean;
  advancingComplete?: boolean;
};

export function TaskCard({
  task,
  onStart,
  onComplete,
  advancingStart = false,
  advancingComplete = false
}: TaskCardProps) {
  const statusClassName = getStatusClassName(task.status);
  const titleClassName = task.status === "descartada" ? "line-through text-gray-400" : "text-[#1A1A1A]";
  const priorityClassName = getPriorityClassName(task.priority);
  const statusLabel = task.status.replace("_", " ");
  const steps = useMemo(() => {
    if (task.steps && task.steps.length > 0) return task.steps;
    return getTaskSteps(task.title, task.description ?? "", task.category ?? "");
  }, [task.title, task.category, task.description, task.steps]);
  const storageKey = `task_${task.id}_steps`;
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>(() => Array.from({ length: steps.length }, () => false));
  const [expanded, setExpanded] = useState(task.status === "en_curso");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setCheckedSteps(Array.from({ length: steps.length }, () => false));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as boolean[];
      const next = steps.map((_, index) => Boolean(parsed[index]));
      setCheckedSteps(next);
    } catch {
      setCheckedSteps(Array.from({ length: steps.length }, () => false));
    }
  }, [storageKey, steps]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checkedSteps));
  }, [checkedSteps, storageKey]);

  useEffect(() => {
    if (task.status === "en_curso") setExpanded(true);
    if (task.status === "completada") setExpanded(false);
  }, [task.status]);

  const completedCount = checkedSteps.filter(Boolean).length;
  const allChecked = completedCount === steps.length && steps.length > 0;

  return (
    <article className={cn("bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4 hover:shadow-sm transition-shadow duration-150", statusClassName)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", titleClassName)}>{task.title}</p>
          {task.category ? (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">{formatBlockCategory(task.category)}</p>
          ) : null}
        </div>
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
            onClick={() => onStart?.(task.id)}
            disabled={advancingStart}
          >
            {advancingStart ? "Iniciando..." : "Iniciar"}
          </button>
        ) : null}
        {task.status === "en_curso" ? (
          <button
            type="button"
            className="rounded-lg bg-[#FFD600] px-3 py-2 text-xs font-semibold text-[#1A1A1A] disabled:opacity-70"
            onClick={() => onComplete?.(task.id)}
            disabled={advancingComplete || !allChecked}
          >
            {advancingComplete ? "Completando..." : allChecked ? "Completar tarea" : "Completá los pasos"}
          </button>
        ) : null}
      </div>

      {task.status === "en_curso" && expanded ? (
        <section className="mt-3 rounded-xl border border-[#E8E8E2] bg-[#F5F5F0] p-3">
          <p className="text-sm font-semibold text-[#1A1A1A]">✓ Tarea iniciada · Seguí estos pasos:</p>
          <ul className="mt-3 space-y-2">
            {steps.map((step, index) => (
              <li key={`${task.id}-${index}`} className="flex items-start gap-2 text-sm text-[#1A1A1A]">
                <input
                  id={`${task.id}-step-${index}`}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#1A1A1A]"
                  checked={checkedSteps[index] ?? false}
                  onChange={(event) => {
                    const next = [...checkedSteps];
                    next[index] = event.target.checked;
                    setCheckedSteps(next);
                  }}
                />
                <label htmlFor={`${task.id}-step-${index}`} className={cn((checkedSteps[index] ?? false) ? "line-through text-[#6B6B6B]" : "")}>
                  {step}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-[#6B6B6B]">
            <span>{`${completedCount}/${steps.length} completados`}</span>
            <span className="text-[#1A1A1A]">{allChecked ? "Listo para completar" : "Marcá todos los pasos"}</span>
          </div>
        </section>
      ) : null}
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

function formatBlockCategory(categoria: string) {
  const block = OPS_BLOCKS.find((b) => b.key === categoria);
  return block ? `${block.number} ${block.label}` : categoria.replaceAll("_", " ");
}
