"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import type { BlockKey, Priority } from "@/lib/types";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeBlock(value: string): BlockKey {
  if (value === "salud" || value === "ads" || value === "logistica" || value === "stock") return value;
  return "publicaciones";
}

function normalizePriority(value: string): Priority {
  if (value === "urgente" || value === "alta") return value;
  return "media";
}

function fallbackDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

async function assertOperatorCanAccessClient(clientId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  if (!isSupabaseConfigured()) {
    return { profile, supabase: null };
  }

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).single();
  if (!client) redirect("/operator/dashboard");

  return { profile, supabase };
}

export async function createClientAction(clientId: string, formData: FormData): Promise<ActionResult<{ created: boolean }>> {
  const { profile, supabase } = await assertOperatorCanAccessClient(clientId);

  const titulo = cleanText(formData.get("titulo"));
  const descripcion = cleanText(formData.get("descripcion"));
  const bloque = normalizeBlock(cleanText(formData.get("bloque")));
  const prioridad = normalizePriority(cleanText(formData.get("prioridad")));
  const dueDate = cleanText(formData.get("due_date")) || fallbackDueDate();

  if (!titulo) {
    return { success: false, error: "El titulo de la accion es obligatorio", code: "VALIDATION_ERROR" };
  }

  if (supabase) {
    const { error } = await supabase.from("actions").insert({
      client_id: clientId,
      created_by: profile.id,
      bloque,
      titulo,
      descripcion: descripcion || null,
      prioridad,
      estado: "pendiente",
      due_date: dueDate
    });
    if (error) {
      logServerError("createClientAction", error, { clientId, operatorId: profile.id });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo crear la accion",
        code: error.code
      };
    }
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  return { success: true, data: { created: true } };
}

export async function completeClientAction(
  clientId: string,
  actionId: string
): Promise<ActionResult<{ completed: boolean }>> {
  const { supabase } = await assertOperatorCanAccessClient(clientId);

  if (supabase) {
    const { error } = await supabase
      .from("actions")
      .update({
        estado: "completada",
        completed_at: new Date().toISOString()
      })
      .eq("id", actionId)
      .eq("client_id", clientId);
    if (error) {
      logServerError("completeClientAction", error, { clientId, actionId });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo completar la accion",
        code: error.code
      };
    }
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  return { success: true, data: { completed: true } };
}
