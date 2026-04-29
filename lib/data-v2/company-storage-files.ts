import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types/api";
import { logServerError } from "@/lib/utils/errors";

export type CompanyStorageFile = {
  name: string;
  path: string;
  sizeBytes: number | null;
  updatedAt: string | null;
};

export async function listCompanyClientFiles(companyId: string): Promise<ActionResult<CompanyStorageFile[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from("client-files").list(companyId, {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    logServerError("company-storage-files.list", error, { companyId });
    return {
      success: false,
      error: error.message || "No se pudieron listar archivos",
      code: "STORAGE"
    };
  }

  const rows = (data ?? []).filter((item) => item.name && !item.name.endsWith("/"));
  const mapped: CompanyStorageFile[] = rows.map((item) => ({
    name: item.name,
    path: `${companyId}/${item.name}`,
    sizeBytes: typeof item.metadata?.size === "number" ? item.metadata.size : null,
    updatedAt: item.updated_at ?? item.created_at ?? null
  }));

  return { success: true, data: mapped };
}

export async function createClientFileSignedUrl(path: string, expiresSeconds = 3600): Promise<ActionResult<string>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, expiresSeconds);
  if (error || !data?.signedUrl) {
    logServerError("company-storage-files.signedUrl", error ?? "no_url", { path });
    return {
      success: false,
      error: error?.message ?? "No se pudo generar enlace de descarga",
      code: error?.message
    };
  }
  return { success: true, data: data.signedUrl };
}
