"use client";

import { useMemo, useState, useTransition } from "react";
import { advanceTaskStatus } from "@/app/(ops)/ops/tasks/actions";
import { TaskCard, type TaskCardTask } from "@/components/tasks/task-card";
import type { TaskStatus } from "@/lib/types/enums";

type TasksBoardProps = {
  initialTasks: TaskCardTask[];
};

const STATUS_FILTERS: Array<{ key: "all" | TaskStatus; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "pendiente", label: "Pendientes" },
  { key: "en_curso", label: "En curso" },
  { key: "completada", label: "Completadas" }
];

export function TasksBoard({ initialTasks }: TasksBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedStatus, setSelectedStatus] = useState<"all" | TaskStatus>("all");
  const [error, setError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTasks = useMemo(() => {
    const filtered = selectedStatus === "all" ? tasks : tasks.filter((task) => task.status === selectedStatus);
    return [...filtered].sort((a, b) => sortByTaskGroup(a, b));
  }, [tasks, selectedStatus]);
  const grouped = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);

  if (tasks.length === 0) {
    return <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center text-sm text-[#1A1A1A]">Sin tareas pendientes. Revisá las alertas para crear nuevas.</div>;
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-[#E8E8E2] bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedStatus(item.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${selectedStatus === item.key ? "bg-[#FFD600] text-[#1A1A1A]" : "bg-[#F5F5F0] text-[#1A1A1A]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {grouped.map((group) =>
        group.items.length > 0 ? (
          <section key={group.key} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{group.label}</h2>
            {group.items.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                advancing={isPending && pendingTaskId === task.id}
                onAdvance={(taskId) => {
                  setError(null);
                  setPendingTaskId(taskId);
                  startTransition(async () => {
                    const result = await advanceTaskStatus(taskId);
                    if (!result.success) {
                      setError(result.error);
                      setPendingTaskId(null);
                      return;
                    }

                    setTasks((current) =>
                      current.map((item) => (item.id === taskId ? { ...item, status: result.data.estado } : item))
                    );
                    setPendingTaskId(null);
                  });
                }}
              />
            ))}
          </section>
        ) : null
      )}
    </section>
  );
}

function sortByTaskGroup(a: TaskCardTask, b: TaskCardTask) {
  const rank = (task: TaskCardTask) => {
    if (task.priority === "urgente" && task.status !== "completada") return 0;
    if (task.status === "en_curso") return 1;
    if (task.status === "pendiente") return 2;
    if (task.status === "completada") return 3;
    return 4;
  };

  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.title.localeCompare(b.title);
}

function groupTasks(tasks: TaskCardTask[]) {
  const urgentes = tasks.filter((task) => task.priority === "urgente" && task.status !== "completada");
  const enCurso = tasks.filter((task) => task.status === "en_curso" && task.priority !== "urgente");
  const pendientes = tasks.filter((task) => task.status === "pendiente" && task.priority !== "urgente");
  const completadas = tasks.filter((task) => task.status === "completada");

  return [
    { key: "urgentes", label: "Urgentes", items: urgentes },
    { key: "en_curso", label: "En curso", items: enCurso },
    { key: "pendientes", label: "Pendientes", items: pendientes },
    { key: "completadas", label: "Completadas", items: completadas }
  ];
}
