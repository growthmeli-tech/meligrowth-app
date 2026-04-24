"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizePlan(value: string): Plan {
  if (value === "growth" || value === "scale") return value;
  return "starter";
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 3);
}

function dueDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function createClientOnboarding(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/operator/clients/c-1/diagnostic/new?onboarding=demo");
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") {
    redirect("/client/dashboard");
  }

  const name = cleanText(formData.get("name"));
  const plan = normalizePlan(cleanText(formData.get("plan")));
  const meliAccountUrl = cleanText(formData.get("meli_account_url"));
  const meliSellerId = cleanText(formData.get("meli_seller_id"));
  const clientEmail = cleanText(formData.get("client_email")).toLowerCase();
  const selectedClientUserId = cleanText(formData.get("client_user_id"));

  if (!name) {
    redirect("/operator/clients/new?error=missing");
  }

  const supabase = await createServerSupabaseClient();
  const clientUser = selectedClientUserId
    ? { id: selectedClientUserId }
    : clientEmail
      ? (await supabase.from("users").select("id").eq("email", clientEmail).eq("role", "client").maybeSingle()).data
      : null;

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      initials: initialsFromName(name) || "CL",
      plan,
      operator_id: profile.id,
      client_user_id: clientUser?.id ?? null,
      meli_account_url: meliAccountUrl || null,
      meli_seller_id: meliSellerId || null,
      active: true
    })
    .select("id")
    .single();

  if (error || !client) {
    redirect("/operator/clients/new?error=create");
  }

  await supabase.from("actions").insert([
    {
      client_id: client.id,
      created_by: profile.id,
      bloque: "publicaciones",
      titulo: "Completar diagnóstico inicial",
      descripcion: "Cargar el primer diagnóstico base para activar score, historial y acciones automáticas.",
      prioridad: "urgente",
      estado: "pendiente",
      due_date: dueDate(1)
    },
    {
      client_id: client.id,
      created_by: profile.id,
      bloque: "stock",
      titulo: "Solicitar planilla de SKUs y stock",
      descripcion: "Pedir al cliente la plantilla de stock para habilitar el parser y detectar faltantes.",
      prioridad: "alta",
      estado: "pendiente",
      due_date: dueDate(2)
    },
    {
      client_id: client.id,
      created_by: profile.id,
      bloque: "ads",
      titulo: "Relevar márgenes y costos",
      descripcion: "Validar margen pre ads antes de tomar decisiones sobre inversión publicitaria.",
      prioridad: "alta",
      estado: "pendiente",
      due_date: dueDate(3)
    }
  ]);

  redirect(`/operator/clients/${client.id}/diagnostic/new?onboarding=created`);
}
