"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import type { TaskStatus } from "@/lib/types/enums";

export async function advanceTaskStatus(taskId: string): Promise<ActionResult<{ id: string; estado: TaskStatus }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Sesión inválida. Iniciá sesión nuevamente." };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, estado")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    return { success: false, error: taskError?.message ?? "No pudimos encontrar la tarea." };
  }

  const nextStatus: TaskStatus | null = task.estado === "pendiente" ? "en_curso" : task.estado === "en_curso" ? "completada" : null;
  if (!nextStatus) {
    return { success: false, error: "La tarea ya está finalizada." };
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("tasks")
    .update({
      estado: nextStatus,
      completed_at: nextStatus === "completada" ? new Date().toISOString() : null
    })
    .eq("id", taskId)
    .select("id, estado")
    .maybeSingle();

  if (updateError || !updatedTask) {
    return { success: false, error: updateError?.message ?? "No pudimos actualizar la tarea." };
  }

  await supabase.from("task_events").insert({
    task_id: taskId,
    user_id: user.id,
    evento: "status_changed",
    detalle: `${task.estado}->${nextStatus}`
  });

  revalidatePath("/ops/tasks");
  revalidatePath("/ops/dashboard");

  return { success: true, data: { id: updatedTask.id, estado: updatedTask.estado as TaskStatus } };
}
