"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/types/api";

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
