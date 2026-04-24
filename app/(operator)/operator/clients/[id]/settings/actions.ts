"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consolidateScrapingClient } from "@/lib/diagnostics/consolidate-scraping";
import { getCurrentProfile } from "@/lib/data";
import { encryptJsonString, isAppEncryptionConfigured } from "@/lib/security/encryption";
import { isScraperPipelineConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
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

function safeFilename(filename: string) {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

async function assertOperator(clientId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  if (!isSupabaseConfigured()) return { supabase: null, profile };

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).single();
  if (!client) redirect("/operator/dashboard");

  return { supabase, profile };
}

function parseScrapingType(value: string) {
  if (value === "salud" || value === "publicaciones" || value === "ads" || value === "stock") {
    return value;
  }
  return null;
}

async function callScraper<T>(pathname: string, payload: object): Promise<T> {
  const baseUrl = process.env.SCRAPER_SERVICE_URL;
  const secret = process.env.SCRAPER_SERVICE_SECRET;

  if (!baseUrl || !secret) {
    throw new Error("Missing SCRAPER_SERVICE_URL or SCRAPER_SERVICE_SECRET");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scraper-secret": secret
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string" ? body.detail : `Scraper error (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

export async function updateClientSettings(clientId: string, formData: FormData) {
  const { supabase, profile } = await assertOperator(clientId);

  const name = cleanText(formData.get("name"));
  const plan = normalizePlan(cleanText(formData.get("plan")));
  const clientEmail = cleanText(formData.get("client_email")).toLowerCase();
  const selectedClientUserId = cleanText(formData.get("client_user_id"));
  const meliAccountUrl = cleanText(formData.get("meli_account_url"));
  const meliSellerId = cleanText(formData.get("meli_seller_id"));
  const active = formData.get("active") === "on";

  if (!name) {
    redirect(`/operator/clients/${clientId}/settings?error=missing`);
  }

  if (supabase) {
    const clientUser = selectedClientUserId
      ? { id: selectedClientUserId }
      : clientEmail
        ? (await supabase.from("users").select("id").eq("email", clientEmail).eq("role", "client").maybeSingle()).data
        : null;

    await supabase
      .from("clients")
      .update({
        name,
        initials: initialsFromName(name) || "CL",
        plan,
        operator_id: profile.id,
        client_user_id: clientUser?.id ?? null,
        meli_account_url: meliAccountUrl || null,
        meli_seller_id: meliSellerId || null,
        active
      })
      .eq("id", clientId);
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath(`/operator/clients/${clientId}/settings`);
  revalidatePath("/operator/dashboard");
  redirect(`/operator/clients/${clientId}/settings?saved=1`);
}

export async function uploadMeliSessionFile(clientId: string, formData: FormData) {
  const { supabase, profile } = await assertOperator(clientId);
  const file = formData.get("file");
  const sellerId = cleanText(formData.get("seller_id"));

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/operator/clients/${clientId}/settings?error=missing_session`);
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    redirect(`/operator/clients/${clientId}/settings?error=session_format`);
  }

  if (!supabase) {
    redirect(`/operator/clients/${clientId}/settings?session_saved=1`);
  }

  if (!isAppEncryptionConfigured()) {
    redirect(`/operator/clients/${clientId}/settings?error=session_encryption`);
  }

  const plainText = await file.text();
  const encryptedPayload = encryptJsonString(plainText);
  const encryptedBlob = new Blob([encryptedPayload], { type: "application/json" });

  const storagePath = `${clientId}/${safeFilename(sellerId || "meli-session")}-${Date.now()}.json`;
  const { error: uploadError } = await supabase.storage.from("meli-sessions").upload(storagePath, encryptedBlob, {
    cacheControl: "3600",
    contentType: "application/json",
    upsert: false
  });

  if (uploadError) {
    redirect(`/operator/clients/${clientId}/settings?error=session_upload`);
  }

  await supabase.from("meli_sessions").insert({
    client_id: clientId,
    created_by: profile.id,
    seller_id: sellerId || null,
    storage_path: storagePath,
    status: "uploaded",
    source: "upload",
    warnings: []
  });

  revalidatePath(`/operator/clients/${clientId}/settings`);
  redirect(`/operator/clients/${clientId}/settings?session_saved=1`);
}

export async function validateMeliSession(clientId: string) {
  const { supabase } = await assertOperator(clientId);

  if (!supabase) {
    redirect(`/operator/clients/${clientId}/settings?session_validated=1`);
  }

  const { data: session } = await supabase
    .from("meli_sessions")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    redirect(`/operator/clients/${clientId}/settings?error=missing_session`);
  }

  if (!isScraperPipelineConfigured()) {
    redirect(`/operator/clients/${clientId}/settings?error=scraper_config`);
  }

  try {
    const result = await callScraper<{
      ok: boolean;
      authenticated: boolean;
      warnings?: string[];
      error?: string | null;
    }>("/session/validate", { client_id: clientId, target_tipo: "salud" });

    await supabase
      .from("meli_sessions")
      .update({
        status: result.authenticated ? "validated" : "error",
        last_validated_at: result.authenticated ? new Date().toISOString() : null,
        last_error: result.error ?? null,
        warnings: result.warnings ?? []
      })
      .eq("id", session.id);
  } catch (error) {
    await supabase
      .from("meli_sessions")
      .update({
        status: "error",
        last_validated_at: null,
        last_error: error instanceof Error ? error.message : "No pudimos validar la sesión",
        warnings: []
      })
      .eq("id", session.id);

    revalidatePath(`/operator/clients/${clientId}/settings`);
    redirect(`/operator/clients/${clientId}/settings?error=session_validation_failed`);
  }

  revalidatePath(`/operator/clients/${clientId}/settings`);
  redirect(`/operator/clients/${clientId}/settings?session_validated=1`);
}

export async function runScrapingJob(clientId: string, formData: FormData) {
  const { supabase } = await assertOperator(clientId);

  const tipo = parseScrapingType(cleanText(formData.get("tipo")));
  if (!tipo) {
    redirect(`/operator/clients/${clientId}/settings?error=invalid_job_type`);
  }

  if (!supabase) {
    redirect(`/operator/clients/${clientId}/settings?job_started=1&job_tipo=${tipo}`);
  }

  if (!isScraperPipelineConfigured()) {
    redirect(`/operator/clients/${clientId}/settings?error=scraper_config`);
  }

  const { data: latestSession } = await supabase
    .from("meli_sessions")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) {
    redirect(`/operator/clients/${clientId}/settings?error=missing_session`);
  }

  const { data: job, error: insertError } = await supabase
    .from("scraping_jobs")
    .insert({ client_id: clientId, tipo, estado: "pending" })
    .select("id")
    .single();

  if (insertError || !job) {
    redirect(`/operator/clients/${clientId}/settings?error=job_insert`);
  }

  let consolidated = false;
  try {
    await callScraper("/jobs/run", { job_id: job.id });
    const result = await consolidateScrapingClient(clientId);
    consolidated = Boolean(result.ok && result.consolidated);
  } catch (error) {
    await supabase
      .from("scraping_jobs")
      .update({
        estado: "error",
        error_msg: error instanceof Error ? error.message : "No pudimos ejecutar el scraping",
        finished_at: new Date().toISOString()
      })
      .eq("id", job.id);

    revalidatePath(`/operator/clients/${clientId}`);
    revalidatePath(`/operator/clients/${clientId}/settings`);
    revalidatePath("/operator/settings");
    redirect(`/operator/clients/${clientId}/settings?error=job_run&job_tipo=${tipo}`);
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath(`/operator/clients/${clientId}/settings`);
  revalidatePath("/operator/settings");
  redirect(`/operator/clients/${clientId}/settings?job_started=1&job_tipo=${tipo}${consolidated ? "&consolidated=1" : ""}`);
}
