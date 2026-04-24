"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parsePricingTemplate, parsePricingTemplateSource } from "@/lib/pricing-template";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

function getExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot).toLowerCase();
}

export async function importPricingTemplate(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/operator/pricing?error=missing_file");
  }

  if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
    redirect("/operator/pricing?error=invalid_format");
  }

  let input;
  try {
    input = await parsePricingTemplate(file);
  } catch {
    redirect("/operator/pricing?error=invalid_template");
  }

  const query = new URLSearchParams({
    imported: "1",
    plan: input.plan,
    currentRevenue: String(input.currentRevenue),
    projectedRevenue: String(input.projectedRevenue),
    grossMarginPct: String(input.grossMarginPct),
    deliveryCost: String(input.deliveryCost),
    setupFee: String(input.setupFee),
    months: String(input.months)
  });

  redirect(`/operator/pricing?${query.toString()}`);
}

export async function importPricingTemplateFromClientFile(formData: FormData) {
  const fileId = String(formData.get("clientFileId") ?? "").trim();
  if (!fileId) {
    redirect("/operator/pricing?error=missing_file");
  }

  if (!isSupabaseConfigured()) {
    const query = new URLSearchParams({
      imported: "1",
      importedFrom: "storage",
      plan: "growth",
      currentRevenue: "8000000",
      projectedRevenue: "11500000",
      grossMarginPct: "32",
      deliveryCost: "280000",
      setupFee: "100000",
      months: "6"
    });
    redirect(`/operator/pricing?${query.toString()}`);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") {
    redirect("/client/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: fileRow } = await supabase
    .from("client_files")
    .select("filename, storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (!fileRow || !ALLOWED_EXTENSIONS.includes(getExtension(fileRow.filename))) {
    redirect("/operator/pricing?error=invalid_format");
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("client-files").download(fileRow.storage_path);
  if (downloadError || !blob) {
    redirect("/operator/pricing?error=invalid_template");
  }

  let input;
  try {
    input = await parsePricingTemplateSource({
      filename: fileRow.filename,
      text: () => blob.text(),
      arrayBuffer: () => blob.arrayBuffer()
    });
  } catch {
    redirect("/operator/pricing?error=invalid_template");
  }

  const query = new URLSearchParams({
    imported: "1",
    importedFrom: "storage",
    plan: input.plan,
    currentRevenue: String(input.currentRevenue),
    projectedRevenue: String(input.projectedRevenue),
    grossMarginPct: String(input.grossMarginPct),
    deliveryCost: String(input.deliveryCost),
    setupFee: String(input.setupFee),
    months: String(input.months)
  });

  redirect(`/operator/pricing?${query.toString()}`);
}
