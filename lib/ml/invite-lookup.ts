import "server-only";

import { hashInviteToken, normalizeInviteEmail } from "@/lib/ml/account-invite";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";

type InviteRow = Database["public"]["Tables"]["ml_account_invites"]["Row"];

export type PublicInviteView = {
  id: string;
  mlAccountId: string;
  companyId: string;
  clientEmail: string;
  clientName: string;
  accountLabel: string | null;
  status: InviteRow["status"];
  expiresAt: string;
  usedAt: string | null;
  /** True when seller_id is set on linked ml_account */
  isConnected: boolean;
};

function isExpired(iso: string) {
  return new Date(iso) < new Date();
}

/**
 * Resolves an invite from the raw token (hashed lookup). Service role only — do not call from the client.
 */
export async function getInviteByRawToken(rawToken: string): Promise<PublicInviteView | null> {
  const token = rawToken?.trim();
  if (!token) return null;
  const service = createServiceSupabaseClient();
  const tokenHash = hashInviteToken(token);
  const { data: invite, error } = await service
    .from("ml_account_invites")
    .select("id, ml_account_id, client_email, client_name, optional_account_label, status, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) return null;

  if (invite.status === "pending" && isExpired(invite.expires_at)) {
    await service.from("ml_account_invites").update({ status: "expired" }).eq("id", invite.id);
  }

  const { data: account, error: accErr } = await service
    .from("ml_accounts")
    .select("company_id, seller_id, account_name")
    .eq("id", invite.ml_account_id)
    .maybeSingle();
  if (accErr || !account) return null;

  const effectiveStatus: InviteRow["status"] =
    invite.status === "pending" && isExpired(invite.expires_at) ? "expired" : invite.status;

  return {
    id: invite.id,
    mlAccountId: invite.ml_account_id,
    companyId: account.company_id,
    clientEmail: normalizeInviteEmail(invite.client_email),
    clientName: invite.client_name,
    accountLabel: invite.optional_account_label,
    status: effectiveStatus,
    expiresAt: invite.expires_at,
    usedAt: invite.used_at,
    isConnected: Boolean(account.seller_id)
  };
}

export function sessionEmailMatchesInvite(sessionEmail: string | undefined, inviteEmail: string): boolean {
  if (!sessionEmail) return false;
  return normalizeInviteEmail(sessionEmail) === normalizeInviteEmail(inviteEmail);
}
