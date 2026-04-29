"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { ALLOWED_FILE_EXTENSIONS, getExtension, MAX_FILE_BYTES, safeFilename } from "@/lib/files/client-file-upload";
import { ingestFichaTecnica } from "@/lib/ingestion/pipelines/ingest-ficha-tecnica";
import { ingestMargenesCostos } from "@/lib/ingestion/pipelines/ingest-margenes-costos";
import { ingestPricingComercial } from "@/lib/ingestion/pipelines/ingest-pricing-comercial";
import { ingestSkusStock } from "@/lib/ingestion/pipelines/ingest-skus-stock";
import type { IngestionResult, SkusStockRow, TemplateType } from "@/lib/ingestion/types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

export async function uploadCompanyFolderFile(companyId: string, formData: FormData) {
  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) {
    redirect(`/internal/clients/${companyId}/files?error=forbidden`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/internal/clients/${companyId}/files?error=missing_upload`);
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect(`/internal/clients/${companyId}/files?error=size`);
  }

  if (!ALLOWED_FILE_EXTENSIONS.includes(getExtension(file.name))) {
    redirect(`/internal/clients/${companyId}/files?error=format`);
  }

  const { supabase } = gate.data;

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (companyError || !company) {
    redirect(`/internal/clients/${companyId}/files?error=company`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = safeFilename(file.name);
  const storagePath = `${companyId}/${timestamp}-${filename}`;

  const { error: uploadError } = await supabase.storage.from("client-files").upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) {
    logServerError("uploadCompanyFolderFile.storage", uploadError, { companyId });
    redirect(`/internal/clients/${companyId}/files?error=storage`);
  }

  revalidatePath(`/internal/clients/${companyId}/files`);
  redirect(`/internal/clients/${companyId}/files?uploaded=1`);
}

type IngestionMeta = {
  mlAccountId: string;
  templateType: TemplateType;
  rows: Record<string, unknown>[];
};

/**
 * Sube a Storage y ejecuta el pipeline (validacion client-side, sin parsear de nuevo el archivo en servidor).
 * Alias: processUploadedFile (contrato tarea)
 */
export async function processUploadedFile(companyId: string, formData: FormData): Promise<ActionResult<IngestionResult>> {
  return importAndProcessClientFile(companyId, formData);
}

export async function importAndProcessClientFile(companyId: string, formData: FormData): Promise<ActionResult<IngestionResult>> {
  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) {
    return { success: false, error: gate.error, code: gate.code };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Falta el archivo", code: "VALIDATION" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "El archivo excede 10 MB", code: "VALIDATION" };
  }
  if (!ALLOWED_FILE_EXTENSIONS.includes(getExtension(file.name))) {
    return { success: false, error: "Formato no permitido", code: "VALIDATION" };
  }

  const rawMeta = formData.get("meta");
  if (typeof rawMeta !== "string" || !rawMeta.trim()) {
    return { success: false, error: "Falta metadata de importacion", code: "VALIDATION" };
  }

  let meta: IngestionMeta;
  try {
    meta = JSON.parse(rawMeta) as IngestionMeta;
  } catch {
    return { success: false, error: "Metadata invalida", code: "VALIDATION" };
  }
  if (!meta.mlAccountId || !meta.templateType || !Array.isArray(meta.rows)) {
    return { success: false, error: "Estructura de importacion invalida", code: "VALIDATION" };
  }
  if (meta.templateType === "unknown") {
    return { success: false, error: "Tipo de plantilla desconocido", code: "VALIDATION" };
  }

  const { supabase } = gate.data;
  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (companyError || !company) {
    return { success: false, error: "Empresa no encontrada", code: "NOT_FOUND" };
  }

  const { data: account, error: accErr } = await supabase
    .from("ml_accounts")
    .select("id, company_id")
    .eq("id", meta.mlAccountId)
    .maybeSingle();
  if (accErr || !account) {
    return { success: false, error: "Cuenta ML no encontrada", code: "NOT_FOUND" };
  }
  if (account.company_id !== companyId) {
    return { success: false, error: "La cuenta no pertenece a esta empresa", code: "FORBIDDEN" };
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = safeFilename(file.name);
  const storagePath = `${companyId}/${ts}-${name}`;

  const { error: upErr } = await supabase.storage.from("client-files").upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (upErr) {
    logServerError("importAndProcessClientFile.storage", upErr, { companyId });
    return {
      success: false,
      error: isPostgresError(upErr) ? formatSupabaseError(upErr) : upErr.message,
      code: "STORAGE"
    };
  }

  let out: IngestionResult;
  const rows = meta.rows;
  const filename = file.name;

  try {
    if (meta.templateType === "skus_stock") {
      out = await ingestSkusStock(account.id, companyId, rows as unknown as SkusStockRow[], filename, storagePath);
    } else if (meta.templateType === "margenes_costos") {
      out = await ingestMargenesCostos(account.id, companyId, rows, (r, f) => (r as Record<string, unknown>)[f], filename, storagePath);
    } else if (meta.templateType === "ficha_tecnica") {
      out = await ingestFichaTecnica(account.id, companyId, rows, filename, storagePath);
    } else {
      out = await ingestPricingComercial(account.id, companyId, rows, filename, storagePath);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado en ingesta";
    logServerError("importAndProcessClientFile.pipeline", e, { companyId, template: meta.templateType });
    revalidatePath(`/internal/clients/${companyId}/files`);
    return { success: false, error: msg, code: "INGESTION" };
  }

  revalidatePath(`/internal/clients/${companyId}/files`);
  return { success: true, data: out };
}
