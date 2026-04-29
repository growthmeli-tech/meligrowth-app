import { TasksBoard } from "@/components/ops/tasks-board";
import { EmptyState } from "@/components/ui/empty-state";
import { getInternalDashboardCompanies } from "@/lib/data-v2/dashboard-internal";
import type { TaskPriority, TaskStatus } from "@/lib/types/enums";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InternalTaskRow = {
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

export default async function InternalTasksPage() {
  const dashboardResult = await getInternalDashboardCompanies();

  if (!dashboardResult.success) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No pudimos cargar la cartera de cuentas. Reintentá en unos minutos.
        </div>
      </main>
    );
  }

  const accountIds = dashboardResult.data.map((row) => row.mlAccount?.id).filter((id): id is string => Boolean(id));

  if (accountIds.length === 0) {
    return (
      <main className="p-4 md:p-6">
        <EmptyState context="cuenta" />
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, titulo, descripcion, prioridad, due_date, estado, ml_account_id, assigned_to, alert_id, steps, alerts(categoria)")
    .in("ml_account_id", accountIds)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar tareas.</div>
      </main>
    );
  }

  const tasks = (data ?? []) as InternalTaskRow[];
  if (tasks.length === 0) {
    return (
      <main className="p-4 md:p-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-[#1A1A1A]">Tareas</h1>
          <p className="text-sm text-[#6B6B6B]">Seguimiento operativo de la cartera.</p>
        </header>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center text-sm text-[#1A1A1A]">
          Sin tareas pendientes. Revisá las alertas para crear nuevas.
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Tareas</h1>
        <p className="text-sm text-[#6B6B6B]">Seguimiento operativo de la cartera.</p>
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
