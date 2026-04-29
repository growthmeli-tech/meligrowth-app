import { TasksBoard } from "@/components/ops/tasks-board";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentViewerProfile, getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import type { TaskPriority, TaskStatus } from "@/lib/types/enums";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type OpsTaskRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: TaskPriority;
  due_date: string | null;
  estado: TaskStatus;
  ml_account_id: string;
  assigned_to: string | null;
  alert_id: string | null;
  steps: unknown;
  alerts: { categoria: string | null } | null;
};

export default async function OpsTasksPage() {
  const [viewerResult, accountResult] = await Promise.all([getCurrentViewerProfile(), getPrimaryAccountForOperator()]);
  if (!accountResult.success || !accountResult.data) return <EmptyState context="cuenta" />;
  if (!viewerResult.success || !viewerResult.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos resolver tu perfil de usuario.</div>;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, titulo, descripcion, prioridad, due_date, estado, ml_account_id, assigned_to, alert_id, steps, alerts(categoria)")
    .or(`assigned_to.eq.${viewerResult.data.userId},ml_account_id.eq.${accountResult.data.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar tareas.</div>;
  }

  const tasks = (data ?? []) as OpsTaskRow[];
  if (tasks.length === 0) {
    return <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center text-sm text-[#1A1A1A]">Sin tareas pendientes. Revisá las alertas para crear nuevas.</div>;
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Tareas</h1>
      </header>
      <TasksBoard
        initialTasks={tasks.map((task) => ({
          id: task.id,
          title: task.titulo,
          description: task.descripcion,
          category: task.alerts?.categoria ?? null,
          priority: task.prioridad,
          dueDate: task.due_date,
          status: task.estado,
          steps: Array.isArray(task.steps) ? (task.steps as string[]) : null
        }))}
      />
    </main>
  );
}
