"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";

type TaskPriority = "urgente" | "alta" | "media" | "baja";

export async function createTaskFromRecommendation(input: {
  ml_account_id: string;
  titulo: string;
  descripcion: string;
  prioridad: TaskPriority;
  alert_id?: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Sesión inválida. Volvé a iniciar sesión." };
  }

  const { data, error } = await supabase
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

  if (error || !data) {
    return { success: false, error: error?.message ?? "No pudimos crear la tarea." };
  }

  revalidatePath("/internal/clients");
  revalidatePath("/ops/tasks");

  return { success: true, data: { id: data.id } };
}
