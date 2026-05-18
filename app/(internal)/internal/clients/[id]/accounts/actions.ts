"use server";

import { revalidatePath } from "next/cache";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { generateInviteRawToken, hashInviteToken, normalizeInviteEmail } from "@/lib/ml/account-invite";
import { getAppUrl } from "@/lib/config/app-url";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

const INVITE_TTL_DAYS = 14;

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function createMlAccountInviteAction(
  companyId: string,
  formData: FormData
): Promise<ActionResult<{ connectUrl: string; plainToken: string; expiresAt: string }>> {
  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) return gate;

  const clientName = cleanText(formData.get("client_name"));
  const clientEmail = normalizeInviteEmail(cleanText(formData.get("client_email")));
  const optionalLabel = cleanText(formData.get("optional_account_label")) || null;

  if (!clientName || !clientEmail) {
    return { success: false, error: "Nombre comercial y email del cliente son obligatorios.", code: "VALIDATION_ERROR" };
  }

  const { supabase, userId } = gate.data;

  const { data: company, error: coErr } = await supabase.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (coErr || !company) {
    return { success: false, error: "Empresa no encontrada.", code: "NOT_FOUND" };
  }

  const accountName = optionalLabel?.trim() || `Pendiente — ${clientName}`;

  const { data: mlRow, error: mlErr } = await supabase
    .from("ml_accounts")
    .insert({
      company_id: companyId,
      account_name: accountName,
      active: true,
      seller_id: null
    })
    .select("id")
    .single();

  if (mlErr || !mlRow) {
    logServerError("createMlAccountInvite.ml_accounts", mlErr ?? "missing_row", { companyId });
    return {
      success: false,
      error: mlErr && isPostgresError(mlErr) ? formatSupabaseError(mlErr) : "No se pudo crear la cuenta ML pendiente",
      code: mlErr?.code
    };
  }

  const plainToken = generateInviteRawToken();
  const tokenHash = hashInviteToken(plainToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: invErr } = await supabase.from("ml_account_invites").insert({
    ml_account_id: mlRow.id,
    client_email: clientEmail,
    client_name: clientName,
    optional_account_label: optionalLabel,
    token_hash: tokenHash,
    expires_at: expiresAt,
    status: "pending",
    created_by: userId
  });

  if (invErr) {
    logServerError("createMlAccountInvite.invite", invErr, { companyId, mlAccountId: mlRow.id });
    await supabase.from("ml_accounts").delete().eq("id", mlRow.id);
    return {
      success: false,
      error: isPostgresError(invErr) ? formatSupabaseError(invErr) : "No se pudo crear la invitación",
      code: invErr.code
    };
  }

  const base = getAppUrl();
  const connectUrl = base ? `${base}/connect/ml?token=${encodeURIComponent(plainToken)}` : `/connect/ml?token=${encodeURIComponent(plainToken)}`;

  revalidatePath(`/internal/clients/${companyId}`);
  revalidatePath(`/internal/clients/${companyId}/accounts`);

  return {
    success: true,
    data: { connectUrl, plainToken, expiresAt }
  };
}
