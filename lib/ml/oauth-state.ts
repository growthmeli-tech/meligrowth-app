import { randomUUID } from "crypto";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";

const TTL_MS = 15 * 60 * 1000;

export type MlOAuthStatePeek = {
  mlAccountId: string;
  inviteId: string | null;
};

type CreateMlOAuthStateOptions = {
  inviteId?: string | null;
};

/** Persists a CSRF state token bound to an ml_account; optional invite context for client onboarding. */
export async function createMlOAuthState(mlAccountId: string, options?: CreateMlOAuthStateOptions): Promise<string> {
  const supabase = createServiceClient();
  const state = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const { error } = await supabase.from("ml_oauth_states").insert({
    state,
    ml_account_id: mlAccountId,
    expires_at: expiresAt,
    invite_id: options?.inviteId ?? null
  });
  if (error) {
    throw new Error(`ml_oauth_states insert failed: ${error.message}`);
  }
  return state;
}

/** Returns bound OAuth context if state exists and is not expired; does not delete. */
export async function peekMlOAuthState(state: string): Promise<MlOAuthStatePeek | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ml_oauth_states")
    .select("ml_account_id, expires_at, invite_id")
    .eq("state", state)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from("ml_oauth_states").delete().eq("state", state);
    return null;
  }
  return {
    mlAccountId: data.ml_account_id as string,
    inviteId: (data.invite_id as string | null) ?? null
  };
}

/** Removes state after successful OAuth completion (one-time use). */
export async function deleteMlOAuthState(state: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("ml_oauth_states").delete().eq("state", state);
}
