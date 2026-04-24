import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type FileType = Database["public"]["Tables"]["client_files"]["Row"]["tipo"];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FILE_EXTENSIONS = [".csv", ".xlsx", ".ods"];

export function getExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot).toLowerCase();
}

export function inferFileType(filename: string): FileType {
  const normalized = filename.toLowerCase();
  if (normalized.includes("stock") || normalized.includes("sku")) return "skus_stock";
  if (normalized.includes("margen") || normalized.includes("costo")) return "margenes";
  if (normalized.includes("ficha") || normalized.includes("producto")) return "ficha_tecnica";
  return "otro";
}

export function safeFilename(filename: string) {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

export async function uploadClientFileRecord({
  supabase,
  clientId,
  uploadedBy,
  file
}: {
  supabase: SupabaseClient<Database>;
  clientId: string;
  uploadedBy: string;
  file: File;
}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = safeFilename(file.name);
  const storagePath = `${clientId}/${timestamp}-${filename}`;

  const { error: uploadError } = await supabase.storage.from("client-files").upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) {
    return { ok: false as const, reason: "storage" };
  }

  const { data: insertedFile, error: insertError } = await supabase
    .from("client_files")
    .insert({
      client_id: clientId,
      uploaded_by: uploadedBy,
      tipo: inferFileType(file.name),
      filename: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      procesado: false
    })
    .select("id")
    .single();

  if (insertError || !insertedFile) {
    await supabase.storage.from("client-files").remove([storagePath]);
    return { ok: false as const, reason: "record" };
  }

  return {
    ok: true as const,
    fileId: insertedFile.id,
    storagePath
  };
}
