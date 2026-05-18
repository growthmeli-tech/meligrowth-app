import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveSessionTokens } from "@/lib/ml/auth";
import { deleteMlOAuthState, peekMlOAuthState } from "@/lib/ml/oauth-state";
import type { MlOAuthStatePeek } from "@/lib/ml/oauth-state";
import { mlFetch } from "@/lib/ml/client";
import type { MlTokenResponse } from "@/lib/ml/mappers/types";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

const CALLBACK_TAG = "[ml-auth-callback]";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MlAccountRef = { id: string; company_id: string };
type MlSellerProfile = { accountName: string; accountUrl: string | null };

function internalClientsRedirect(request: Request, errorCode: string) {
  return NextResponse.redirect(
    new URL(`/internal/clients?ml_error=${encodeURIComponent(errorCode)}`, request.url)
  );
}

function connectErrorRedirect(request: Request, reason: string) {
  const url = new URL("/connect/ml/error", request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/** Maps RPC result codes to public /connect/ml/error reason query params. */
function mapInviteRpcCodeToReason(code: string | null | undefined): string {
  switch (code) {
    case "expired_invite":
      return "expired_invite";
    case "invite_email_mismatch":
      return "invite_email_mismatch";
    case "duplicate_seller":
      return "duplicate_seller";
    case "expired_state":
    case "invalid_state":
    case "invalid_invite":
    case "invalid_ml_account":
      return "invalid_invite";
    default:
      return "invalid_invite";
  }
}

/** Avoids leaking internal error strings in operator-facing redirect URLs. */
function sanitizedInternalErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "oauth_callback_failed";

  switch (error.message) {
    case "forbidden_oauth_completion":
      return "forbidden";
    case "profile_missing":
      return "session_invalid";
    case "invalid_callback_account":
      return "invalid_state";
    case "missing_ml_user_id":
      return "oauth_callback_failed";
    default:
      if (error.message.startsWith("account_update_failed")) return "account_update_failed";
      return "oauth_callback_failed";
  }
}

async function assertNonInviteCompletion(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  mlAccountId: string,
  companyId: string
): Promise<void> {
  const { data: profile, error: profileError } = await service
    .from("users_v2")
    .select("role, company_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) throw new Error("profile_missing");

  if (profile.role === "super_admin_meli_growth" || profile.role === "internal_operator_meli_growth") {
    return;
  }

  const { data: access } = await service
    .from("user_account_access")
    .select("id")
    .eq("user_id", userId)
    .eq("ml_account_id", mlAccountId)
    .maybeSingle();
  if (access) return;

  if (
    profile.company_id === companyId &&
    (profile.role === "client_manager" || profile.role === "client_operator")
  ) {
    return;
  }

  throw new Error("forbidden_oauth_completion");
}

async function loadMlAccount(
  service: ReturnType<typeof createServiceClient>,
  mlAccountId: string
): Promise<MlAccountRef> {
  const { data, error } = await service.from("ml_accounts").select("id, company_id").eq("id", mlAccountId).maybeSingle();
  if (error || !data) {
    console.error(`${CALLBACK_TAG} ml_account_lookup_failed`, {
      mlAccountId,
      error: error?.message ?? "not_found"
    });
    throw new Error("invalid_callback_account");
  }
  return data;
}

async function fetchMlSellerProfile(accessToken: string, sellerId: number): Promise<MlSellerProfile> {
  const profile = await mlFetch<{ nickname?: string; permalink?: string }>(`/users/${sellerId}`, {
    token: accessToken
  });
  return {
    accountName: profile.nickname?.trim() || `ML ${sellerId}`,
    accountUrl: profile.permalink?.trim() || null
  };
}

function buildSessionTokenPayload(tokens: MlTokenResponse) {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
  };
}

/**
 * Writes ML tokens to Supabase Storage. Runs only after Postgres commits (RPC or upsert).
 * Storage cannot join the DB transaction; failure here yields a connected account without a session file.
 */
async function persistSessionTokens(mlAccountId: string, tokens: MlTokenResponse): Promise<void> {
  const storagePath = `${mlAccountId}/session.json`;
  console.info(`${CALLBACK_TAG} saving_tokens`, { mlAccountId, storagePath });
  await saveSessionTokens(storagePath, buildSessionTokenPayload(tokens));
  console.info(`${CALLBACK_TAG} tokens_saved`, { mlAccountId, storagePath });
}

async function completeInviteOAuthCallback(input: {
  request: Request;
  state: string;
  oauthState: MlOAuthStatePeek;
  tokens: MlTokenResponse;
  sellerId: string;
  user: User;
  service: ReturnType<typeof createServiceClient>;
}): Promise<NextResponse> {
  const { request, state, oauthState, tokens, sellerId, user, service } = input;
  const inviteId = oauthState.inviteId;
  if (!inviteId) {
    return connectErrorRedirect(request, "invalid_invite");
  }

  const sellerProfile = await fetchMlSellerProfile(tokens.access_token, tokens.user_id!);

  const { data: completionCode, error: completionError } = await service.rpc("complete_ml_account_invite_connection", {
    p_state: state,
    p_invite_id: inviteId,
    p_user_id: user.id,
    p_session_email: user.email!,
    p_seller_id: sellerId,
    p_account_name: sellerProfile.accountName,
    p_account_url: sellerProfile.accountUrl
  });

  if (completionError || completionCode !== "ok") {
    console.warn(`${CALLBACK_TAG} invite_completion_rejected`, {
      code: completionCode ?? "rpc_error",
      errorCode: completionError?.code,
      inviteId,
      mlAccountId: oauthState.mlAccountId
    });
    return connectErrorRedirect(request, mapInviteRpcCodeToReason(completionCode));
  }

  try {
    await persistSessionTokens(oauthState.mlAccountId, tokens);
  } catch (tokenError) {
    console.error(`${CALLBACK_TAG} token_persist_failed`, {
      inviteId,
      mlAccountId: oauthState.mlAccountId,
      error: tokenError instanceof Error ? tokenError.message : "unknown_error"
    });
    return connectErrorRedirect(request, "token_persist_failed");
  }

  console.info(`${CALLBACK_TAG} redirect_invite_success`, { mlAccountId: oauthState.mlAccountId });
  return NextResponse.redirect(new URL("/connect/ml/success", request.url));
}

async function completeInternalOAuthCallback(input: {
  request: Request;
  state: string;
  oauthState: MlOAuthStatePeek;
  tokens: MlTokenResponse;
  sellerId: string;
  user: User;
  mlAccount: MlAccountRef;
  service: ReturnType<typeof createServiceClient>;
}): Promise<NextResponse> {
  const { request, state, oauthState, tokens, sellerId, user, mlAccount, service } = input;

  await assertNonInviteCompletion(service, user.id, mlAccount.id, mlAccount.company_id);

  const sellerProfile = await fetchMlSellerProfile(tokens.access_token, tokens.user_id!);

  const { data: duplicateAccount } = await service
    .from("ml_accounts")
    .select("id")
    .eq("company_id", mlAccount.company_id)
    .eq("seller_id", sellerId)
    .neq("id", mlAccount.id)
    .maybeSingle();

  if (duplicateAccount) {
    console.warn(`${CALLBACK_TAG} duplicate_seller`, {
      companyId: mlAccount.company_id,
      mlAccountId: mlAccount.id
    });
    await deleteMlOAuthState(state);
    return connectErrorRedirect(request, "duplicate_seller");
  }

  const { error: updateError } = await service.from("ml_accounts").upsert(
    {
      id: mlAccount.id,
      company_id: mlAccount.company_id,
      seller_id: sellerId,
      account_name: sellerProfile.accountName,
      meli_account_url: sellerProfile.accountUrl,
      active: true
    },
    { onConflict: "id" }
  );

  if (updateError) {
    console.error(`${CALLBACK_TAG} account_update_failed`, {
      mlAccountId: mlAccount.id,
      errorCode: updateError.code,
      error: updateError.message
    });
    throw new Error("account_update_failed");
  }

  await deleteMlOAuthState(state);
  await persistSessionTokens(mlAccount.id, tokens);

  const internalUrl = new URL(`/internal/clients/${mlAccount.company_id}`, request.url);
  internalUrl.searchParams.set("ml_connected", "true");
  console.info(`${CALLBACK_TAG} redirect_internal_success`, { companyId: mlAccount.company_id });
  return NextResponse.redirect(internalUrl);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  console.info(`${CALLBACK_TAG} incoming`, {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasOAuthError: Boolean(oauthError)
  });

  if (!state || !UUID_V4_REGEX.test(state)) {
    console.error(`${CALLBACK_TAG} invalid_state_param`, { hasState: Boolean(state) });
    return new NextResponse(JSON.stringify({ error: "invalid_state" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (oauthError) {
    console.error(`${CALLBACK_TAG} oauth_provider_error`, { oauthError });
    return internalClientsRedirect(request, "oauth_denied");
  }

  if (!code) {
    console.error(`${CALLBACK_TAG} missing_code`);
    return new NextResponse(JSON.stringify({ error: "missing_code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const oauthState = await peekMlOAuthState(state);
  if (!oauthState) {
    console.error(`${CALLBACK_TAG} state_not_found_or_expired`);
    return new NextResponse(JSON.stringify({ error: "invalid_state" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    console.info(`${CALLBACK_TAG} exchanging_code`, { mlAccountId: oauthState.mlAccountId, hasInvite: Boolean(oauthState.inviteId) });
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.user_id) {
      throw new Error("missing_ml_user_id");
    }

    console.info(`${CALLBACK_TAG} exchange_ok`, { mlUserId: tokens.user_id });

    const service = createServiceClient();
    const {
      data: { user },
      error: userError
    } = await (await createServerSupabaseClient()).auth.getUser();

    const mlAccount = await loadMlAccount(service, oauthState.mlAccountId);
    const sellerId = tokens.user_id.toString();

    if (oauthState.inviteId) {
      if (userError || !user?.email) {
        await deleteMlOAuthState(state);
        return connectErrorRedirect(request, "session_required");
      }

      return completeInviteOAuthCallback({
        request,
        state,
        oauthState,
        tokens,
        sellerId,
        user,
        service
      });
    }

    if (userError || !user?.id) {
      await deleteMlOAuthState(state);
      return internalClientsRedirect(request, "session_required");
    }

    return completeInternalOAuthCallback({
      request,
      state,
      oauthState,
      tokens,
      sellerId,
      user,
      mlAccount,
      service
    });
  } catch (error) {
    const publicCode = sanitizedInternalErrorCode(error);
    console.error(`${CALLBACK_TAG} callback_failed`, {
      publicCode,
      detail: error instanceof Error ? error.message : "unknown"
    });
    return internalClientsRedirect(request, publicCode);
  }
}
