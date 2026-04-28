"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/types/api";
import type { TaskStatus } from "@/lib/types/enums";

export async function createTaskFromRecommendation(input: {
  ml_account_id: string;
  titulo: string;
  descripcion: string;
  prioridad: "urgente" | "alta" | "media" | "baja";
  alert_id?: string;
}): Promise<ActionResult<{ task_id: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." };
  }

  const service = createServiceSupabaseClient();
  const { data: accessRow, error: accessError } = await service
    .from("user_account_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("ml_account_id", input.ml_account_id)
    .limit(1)
    .maybeSingle();

  if (accessError || !accessRow) {
    return { success: false, error: "No tenés acceso a esta cuenta para crear tareas." };
  }

  const { data: taskRow, error: taskError } = await service
    .from("tasks")
    .insert({
      ml_account_id: input.ml_account_id,
      alert_id: input.alert_id ?? null,
      titulo: input.titulo,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      estado: "pendiente",
      assigned_to: null
    })
    .select("id")
    .single();

  if (taskError || !taskRow) {
    return { success: false, error: taskError?.message ?? "No pudimos crear la tarea." };
  }

  const { error: eventError } = await service.from("task_events").insert({
    task_id: taskRow.id,
    user_id: user.id,
    evento: "creada",
    detalle: "Tarea creada desde alerta operativa"
  });

  if (eventError) {
    return { success: false, error: eventError.message };
  }

  return { success: true, data: { task_id: taskRow.id } };
}

export async function updateTaskStatus(input: {
  task_id: string;
  estado: TaskStatus;
}): Promise<ActionResult<{ task_id: string; estado: TaskStatus }>> {
  if (!["pendiente", "en_curso", "completada", "descartada"].includes(input.estado)) {
    return { success: false, error: "Estado de tarea inválido." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." };
  }

  const service = createServiceSupabaseClient();
  const { data: taskRow, error: taskError } = await service
    .from("tasks")
    .select("id, ml_account_id")
    .eq("id", input.task_id)
    .maybeSingle();

  if (taskError || !taskRow) {
    return { success: false, error: taskError?.message ?? "No pudimos encontrar la tarea." };
  }

  const { data: accessRow, error: accessError } = await service
    .from("user_account_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("ml_account_id", taskRow.ml_account_id)
    .eq("access_type", "operator")
    .limit(1)
    .maybeSingle();

  if (accessError || !accessRow) {
    return { success: false, error: "No tenés acceso para actualizar esta tarea." };
  }

  const updatePayload: {
    estado: TaskStatus;
    completed_at?: string | null;
  } = {
    estado: input.estado
  };

  if (input.estado === "completada") {
    updatePayload.completed_at = new Date().toISOString();
  }

  const { data: updatedRow, error: updateError } = await service
    .from("tasks")
    .update(updatePayload)
    .eq("id", input.task_id)
    .select("id, estado")
    .maybeSingle();

  if (updateError || !updatedRow) {
    return { success: false, error: updateError?.message ?? "No pudimos actualizar la tarea." };
  }

  const { error: eventError } = await service.from("task_events").insert({
    task_id: input.task_id,
    user_id: user.id,
    evento: "estado_cambiado",
    detalle: input.estado
  });
  if (eventError) {
    return { success: false, error: eventError.message };
  }

  return {
    success: true,
    data: {
      task_id: updatedRow.id,
      estado: updatedRow.estado as TaskStatus
    }
  };
}
