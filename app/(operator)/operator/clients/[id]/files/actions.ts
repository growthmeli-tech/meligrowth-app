"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { ALLOWED_FILE_EXTENSIONS, getExtension, MAX_FILE_BYTES, uploadClientFileRecord } from "@/lib/files/client-file-upload";
import { processClientFile } from "@/lib/files/process-client-file";
import { isParserPipelineConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function uploadOperatorClientFile(clientId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(`/operator/clients/${clientId}/files?uploaded=uploaded`);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") {
    redirect("/client/dashboard");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/operator/clients/${clientId}/files?error=missing_upload`);
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect(`/operator/clients/${clientId}/files?error=size`);
  }

  if (!ALLOWED_FILE_EXTENSIONS.includes(getExtension(file.name))) {
    redirect(`/operator/clients/${clientId}/files?error=format`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("id").eq("id", clientId).single();
  if (!clientRow) {
    redirect(`/operator/clients/${clientId}/files?error=client`);
  }

  const uploaded = await uploadClientFileRecord({
    supabase,
    clientId,
    uploadedBy: profile.id,
    file
  });

  if (!uploaded.ok && uploaded.reason === "storage") {
    redirect(`/operator/clients/${clientId}/files?error=storage`);
  }
  if (!uploaded.ok) {
    redirect(`/operator/clients/${clientId}/files?error=record`);
  }

  let result = "uploaded";
  if (isParserPipelineConfigured()) {
    const processed = await processClientFile(uploaded.fileId);
    result = processed.ok ? "processed" : "processing_error";
  }

  revalidatePath(`/operator/clients/${clientId}/files`);
  revalidatePath("/client/files");
  redirect(`/operator/clients/${clientId}/files?uploaded=${result}`);
}

export async function reprocessClientFile(clientId: string, fileId: string) {
  if (!isSupabaseConfigured()) {
    redirect(`/operator/clients/${clientId}/files`);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") {
    redirect("/client/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: fileRow } = await supabase.from("client_files").select("id").eq("id", fileId).eq("client_id", clientId).single();
  if (!fileRow) {
    redirect(`/operator/clients/${clientId}/files?error=missing`);
  }

  if (!isParserPipelineConfigured()) {
    redirect(`/operator/clients/${clientId}/files?error=config`);
  }

  const result = await processClientFile(fileId);

  revalidatePath(`/operator/clients/${clientId}/files`);
  revalidatePath("/client/files");
  redirect(`/operator/clients/${clientId}/files?processed=${result.ok ? "1" : "0"}`);
}
