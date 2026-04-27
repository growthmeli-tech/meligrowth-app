import { TaskCard } from "@/components/tasks/task-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listTasksByAccount } from "@/lib/data-v2/tasks";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsTasksPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) return <EmptyState context="tareas" />;

  const tasksResult = await listTasksByAccount(accountResult.data.id);
  if (!tasksResult.success || !tasksResult.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar tareas.</div>;
  }

  if (tasksResult.data.length === 0) return <EmptyState context="tareas" />;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Tareas</h1>
      </header>
      <section className="space-y-3">
        {tasksResult.data.map((task) => (
          <TaskCard
            key={task.id}
            task={{
              id: task.id,
              title: task.titulo,
              block: task.prioridad,
              dueDate: task.due_date,
              assignee: task.assigned_to,
              status: task.estado
            }}
          />
        ))}
      </section>
    </main>
  );
}
