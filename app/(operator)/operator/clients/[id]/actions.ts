"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BlockKey, Priority } from "@/lib/types";

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

export async function createClientAction(clientId: string, formData: FormData) {
  const { profile, supabase } = await assertOperatorCanAccessClient(clientId);

  const titulo = cleanText(formData.get("titulo"));
  const descripcion = cleanText(formData.get("descripcion"));
  const bloque = normalizeBlock(cleanText(formData.get("bloque")));
  const prioridad = normalizePriority(cleanText(formData.get("prioridad")));
  const dueDate = cleanText(formData.get("due_date")) || fallbackDueDate();

  if (!titulo) {
    redirect(`/operator/clients/${clientId}?tab=acciones&error=missing_action`);
  }

  if (supabase) {
    await supabase.from("actions").insert({
      client_id: clientId,
      created_by: profile.id,
      bloque,
      titulo,
      descripcion: descripcion || null,
      prioridad,
      estado: "pendiente",
      due_date: dueDate
    });
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  redirect(`/operator/clients/${clientId}?tab=acciones&created=1`);
}

export async function completeClientAction(clientId: string, actionId: string) {
  const { supabase } = await assertOperatorCanAccessClient(clientId);

  if (supabase) {
    await supabase
      .from("actions")
      .update({
        estado: "completada",
        completed_at: new Date().toISOString()
      })
      .eq("id", actionId)
      .eq("client_id", clientId);
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/dashboard");
  redirect(`/operator/clients/${clientId}?tab=acciones&completed=1`);
}
