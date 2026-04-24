"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { ALLOWED_FILE_EXTENSIONS, getExtension, MAX_FILE_BYTES, uploadClientFileRecord } from "@/lib/files/client-file-upload";
import { processClientFile } from "@/lib/files/process-client-file";
import { isParserPipelineConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function uploadClientFile(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/client/files?uploaded=1");
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "client") {
    redirect("/operator/dashboard");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/client/files?error=missing");
  }

  if (file.size > MAX_FILE_BYTES) {
    redirect("/client/files?error=size");
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    redirect("/client/files?error=format");
  }

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("id").eq("client_user_id", profile.id).single();
  if (!clientRow) {
    redirect("/client/files?error=client");
  }

  const uploaded = await uploadClientFileRecord({
    supabase,
    clientId: clientRow.id,
    uploadedBy: profile.id,
    file
  });

  if (!uploaded.ok && uploaded.reason === "storage") {
    redirect("/client/files?error=storage");
  }
  if (!uploaded.ok) {
    redirect("/client/files?error=record");
  }

  let result = "uploaded";
  if (isParserPipelineConfigured()) {
    const processed = await processClientFile(uploaded.fileId);
    result = processed.ok ? "processed" : "processing_error";
  }

  revalidatePath("/client/files");
  revalidatePath(`/operator/clients/${clientRow.id}/files`);
  redirect(`/client/files?uploaded=${result}`);
}
