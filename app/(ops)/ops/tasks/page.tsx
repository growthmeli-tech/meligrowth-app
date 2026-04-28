import { TasksBoard } from "@/components/ops/tasks-board";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentViewerProfile, getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OpsTasksPage() {
  const [viewerResult, accountResult] = await Promise.all([getCurrentViewerProfile(), getPrimaryAccountForOperator()]);
  if (!viewerResult.success || !accountResult.success || !accountResult.data) return <EmptyState context="tareas" />;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, titulo, descripcion, prioridad, due_date, estado, ml_account_id, assigned_to")
    .or(`assigned_to.eq.${viewerResult.data.userId},ml_account_id.eq.${accountResult.data.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar tareas.</div>;
  }

  const tasks = data ?? [];
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
          category: null,
          priority: task.prioridad,
          dueDate: task.due_date,
          status: task.estado
        }))}
      />
    </main>
  );
}
