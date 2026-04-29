"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ALLOWED_FILE_EXTENSIONS, getExtension, MAX_FILE_BYTES, safeFilename } from "@/lib/files/client-file-upload";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { logServerError } from "@/lib/utils/errors";

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
