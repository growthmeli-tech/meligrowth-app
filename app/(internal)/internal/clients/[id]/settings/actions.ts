"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consolidateScrapingClient } from "@/lib/diagnostics/consolidate-scraping";
import { getCurrentProfile } from "@/lib/data";
import { encryptJsonString, isAppEncryptionConfigured } from "@/lib/security/encryption";
import { isScraperPipelineConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import type { Plan } from "@/lib/types";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

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

export async function updateClientSettings(
  clientId: string,
  formData: FormData
): Promise<ActionResult<{ updated: boolean }>> {
  const { supabase, profile } = await assertOperator(clientId);

  const name = cleanText(formData.get("name"));
  const plan = normalizePlan(cleanText(formData.get("plan")));
  const clientEmail = cleanText(formData.get("client_email")).toLowerCase();
  const selectedClientUserId = cleanText(formData.get("client_user_id"));
  const meliAccountUrl = cleanText(formData.get("meli_account_url"));
  const meliSellerId = cleanText(formData.get("meli_seller_id"));
  const active = formData.get("active") === "on";

  if (!name) {
    return { success: false, error: "El nombre del cliente es obligatorio", code: "VALIDATION_ERROR" };
  }

  if (supabase) {
    const clientUser = selectedClientUserId
      ? { id: selectedClientUserId }
      : clientEmail
        ? (await supabase.from("users").select("id").eq("email", clientEmail).eq("role", "client").maybeSingle()).data
        : null;

    const { error } = await supabase
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
    if (error) {
      logServerError("updateClientSettings", error, { clientId });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron guardar los cambios",
        code: error.code
      };
    }
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath(`/operator/clients/${clientId}/settings`);
  revalidatePath("/operator/dashboard");
  return { success: true, data: { updated: true } };
}

export async function uploadMeliSessionFile(
  clientId: string,
  formData: FormData
): Promise<ActionResult<{ uploaded: boolean }>> {
  const { supabase, profile } = await assertOperator(clientId);
  const file = formData.get("file");
  const sellerId = cleanText(formData.get("seller_id"));

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Debe adjuntar un archivo de sesion", code: "VALIDATION_ERROR" };
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return { success: false, error: "El archivo debe ser JSON", code: "VALIDATION_ERROR" };
  }

  if (!supabase) {
    return { success: true, data: { uploaded: true } };
  }

  if (!isAppEncryptionConfigured()) {
    return { success: false, error: "Falta configurar cifrado de sesion", code: "ENCRYPTION_NOT_CONFIGURED" };
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
    logServerError("uploadMeliSessionFile.upload", uploadError, { clientId, storagePath });
    return {
      success: false,
      error: isPostgresError(uploadError) ? formatSupabaseError(uploadError) : "No se pudo subir la sesion",
      code: "SESSION_UPLOAD_FAILED"
    };
  }

  const { error: insertError } = await supabase.from("meli_sessions").insert({
    client_id: clientId,
    created_by: profile.id,
    seller_id: sellerId || null,
    storage_path: storagePath,
    status: "uploaded",
    source: "upload",
    warnings: []
  });
  if (insertError) {
    logServerError("uploadMeliSessionFile.insert", insertError, { clientId, storagePath });
    return {
      success: false,
      error: isPostgresError(insertError) ? formatSupabaseError(insertError) : "No se pudo registrar la sesion",
      code: insertError.code
    };
  }

  revalidatePath(`/operator/clients/${clientId}/settings`);
  return { success: true, data: { uploaded: true } };
}

export async function validateMeliSession(clientId: string): Promise<ActionResult<{ validated: boolean }>> {
  const { supabase } = await assertOperator(clientId);

  if (!supabase) {
    return { success: true, data: { validated: true } };
  }

  const { data: session } = await supabase
    .from("meli_sessions")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { success: false, error: "No hay sesion para validar", code: "MISSING_SESSION" };
  }

  if (!isScraperPipelineConfigured()) {
    return { success: false, error: "Pipeline de scraping no configurado", code: "SCRAPER_CONFIG" };
  }

  try {
    const result = await callScraper<{
      ok: boolean;
      authenticated: boolean;
      warnings?: string[];
      error?: string | null;
    }>("/session/validate", { client_id: clientId, target_tipo: "salud" });

    const { error } = await supabase
      .from("meli_sessions")
      .update({
        status: result.authenticated ? "validated" : "error",
        last_validated_at: result.authenticated ? new Date().toISOString() : null,
        last_error: result.error ?? null,
        warnings: result.warnings ?? []
      })
      .eq("id", session.id);
    if (error) {
      logServerError("validateMeliSession.update", error, { clientId, sessionId: session.id });
      return {
        success: false,
        error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo actualizar la sesion",
        code: error.code
      };
    }
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
    logServerError("validateMeliSession", error, { clientId, sessionId: session.id });
    return { success: false, error: "No pudimos validar la sesion", code: "SESSION_VALIDATION_FAILED" };
  }

  revalidatePath(`/operator/clients/${clientId}/settings`);
  return { success: true, data: { validated: true } };
}

export async function runScrapingJob(
  clientId: string,
  formData: FormData
): Promise<ActionResult<{ started: boolean; consolidated: boolean }>> {
  const { supabase } = await assertOperator(clientId);

  const tipo = parseScrapingType(cleanText(formData.get("tipo")));
  if (!tipo) {
    return { success: false, error: "Tipo de scraping invalido", code: "INVALID_JOB_TYPE" };
  }

  if (!supabase) {
    return { success: true, data: { started: true, consolidated: false } };
  }

  if (!isScraperPipelineConfigured()) {
    return { success: false, error: "Pipeline de scraping no configurado", code: "SCRAPER_CONFIG" };
  }

  const { data: latestSession } = await supabase
    .from("meli_sessions")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSession) {
    return { success: false, error: "No hay sesion valida para ejecutar scraping", code: "MISSING_SESSION" };
  }

  const { data: job, error: insertError } = await supabase
    .from("scraping_jobs")
    .insert({ client_id: clientId, tipo, estado: "pending" })
    .select("id")
    .single();

  if (insertError || !job) {
    logServerError("runScrapingJob.insert", insertError ?? "job_not_created", { clientId, tipo });
    return {
      success: false,
      error: insertError && isPostgresError(insertError) ? formatSupabaseError(insertError) : "No se pudo crear el job",
      code: insertError?.code
    };
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
    logServerError("runScrapingJob.run", error, { clientId, tipo, jobId: job.id });
    return { success: false, error: "No se pudo ejecutar el scraping", code: "SCRAPING_RUN_FAILED" };
  }

  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath(`/operator/clients/${clientId}/settings`);
  revalidatePath("/operator/settings");
  return { success: true, data: { started: true, consolidated } };
}
