import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveSessionTokens } from "@/lib/ml/auth";
import { deleteMlOAuthState, peekMlOAuthState } from "@/lib/ml/oauth-state";
import { mlFetch } from "@/lib/ml/client";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sessionEmailMatchesInvite } from "@/lib/ml/invite-lookup";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function internalClientsRedirect(request: Request, search: string) {
  return NextResponse.redirect(new URL(`/internal/clients?${search}`, request.url));
}

function connectErrorRedirect(request: Request, reason: string) {
  const url = new URL("/connect/ml/error", request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

async function assertNonInviteCompletion(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  mlAccountId: string,
  companyId: string
): Promise<void> {
  const { data: profile, error: pErr } = await service.from("users_v2").select("role, company_id").eq("id", userId).maybeSingle();
  if (pErr || !profile) throw new Error("profile_missing");

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const callbackTag = "[ml-auth-callback]";

  console.info(`${callbackTag} incoming`, {
    pathname: new URL(request.url).pathname,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasOAuthError: Boolean(oauthError)
  });

  if (!state || !UUID_V4_REGEX.test(state)) {
    console.error("[ml-auth:state_mismatch]", { reason: "invalid_or_missing", hasState: Boolean(state) });
    return new NextResponse(JSON.stringify({ error: "invalid_state" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (oauthError) {
    console.error(`${callbackTag} oauth_error`, { oauthError, state });
    return internalClientsRedirect(request, `ml_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    console.error(`${callbackTag} missing_code`, { state });
    return new NextResponse(JSON.stringify({ error: "missing_code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const peeked = await peekMlOAuthState(state);
  if (!peeked) {
    console.error("[ml-auth:state_mismatch]", { state, reason: "not_found_or_expired" });
    return new NextResponse(JSON.stringify({ error: "invalid_state" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const mlAccountIdFromState = peeked.mlAccountId;
  const inviteIdFromState = peeked.inviteId;

  try {
    console.info(`${callbackTag} exchanging_code`, { state, codeLength: code.length });
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.user_id) {
      throw new Error("Missing user_id in ML token response");
    }
    console.info(`${callbackTag} exchange_ok`, {
      state,
      hasAccessToken: Boolean(tokens.access_token),
      hasRefreshToken: Boolean(tokens.refresh_token),
      userId: tokens.user_id
    });

    const supabase = createServiceClient();
    const authSb = await createServerSupabaseClient();
    const {
      data: { user },
      error: userErr
    } = await authSb.auth.getUser();

    const { data: mlAccount, error: mlAccountError } = await supabase
      .from("ml_accounts")
      .select("id, company_id")
      .eq("id", mlAccountIdFromState)
      .maybeSingle();
    if (mlAccountError || !mlAccount) {
      console.error(`${callbackTag} ml_account_lookup_failed`, {
        mlAccountId: mlAccountIdFromState,
        error: mlAccountError?.message
      });
      throw new Error("Invalid callback state");
    }
    const mlAccountId = mlAccount.id;
    const sellerIdStr = tokens.user_id.toString();

    if (inviteIdFromState) {
      if (userErr || !user?.email) {
        await deleteMlOAuthState(state);
        return connectErrorRedirect(request, "session_required");
      }
      const { data: inviteRow, error: invErr } = await supabase
        .from("ml_account_invites")
        .select("id, ml_account_id, client_email, status")
        .eq("id", inviteIdFromState)
        .maybeSingle();
      if (invErr || !inviteRow || inviteRow.status !== "pending") {
        await deleteMlOAuthState(state);
        return connectErrorRedirect(request, "invalid_invite");
      }
      if (inviteRow.ml_account_id !== mlAccountIdFromState) {
        console.warn(`${callbackTag} invite_account_mismatch`, {
          stateMlAccountId: mlAccountIdFromState,
          inviteId: inviteIdFromState
        });
        await deleteMlOAuthState(state);
        return connectErrorRedirect(request, "invalid_invite");
      }
      if (!sessionEmailMatchesInvite(user.email, inviteRow.client_email)) {
        await deleteMlOAuthState(state);
        return connectErrorRedirect(request, "invite_email_mismatch");
      }
    } else {
      if (userErr || !user?.id) {
        await deleteMlOAuthState(state);
        return internalClientsRedirect(request, `ml_error=${encodeURIComponent("session_required")}`);
      }
      await assertNonInviteCompletion(supabase, user.id, mlAccountId, mlAccount.company_id);
    }

    const { data: dupAccount } = await supabase
      .from("ml_accounts")
      .select("id")
      .eq("company_id", mlAccount.company_id)
      .eq("seller_id", sellerIdStr)
      .neq("id", mlAccountId)
      .maybeSingle();
    if (dupAccount) {
      console.warn(`${callbackTag} duplicate_seller`, { companyId: mlAccount.company_id, sellerId: sellerIdStr });
      await deleteMlOAuthState(state);
      return connectErrorRedirect(request, "duplicate_seller");
    }

    const storagePath = `${mlAccountIdFromState}/session.json`;
    const tokenPayload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
    };

    console.info(`${callbackTag} saving_tokens`, { storagePath, mlAccountId: mlAccountIdFromState });
    await saveSessionTokens(storagePath, tokenPayload);
    console.info(`${callbackTag} tokens_saved`, { storagePath, mlAccountId: mlAccountIdFromState });

    const userProfile = await mlFetch<{ id?: number; nickname?: string; permalink?: string }>(`/users/${tokens.user_id}`, {
      token: tokens.access_token
    });
    const accountName = userProfile.nickname?.trim() || `ML ${tokens.user_id}`;
    const accountUrl = userProfile.permalink?.trim() || null;

    const { error: updateError } = await supabase.from("ml_accounts").upsert(
      {
        id: mlAccountId,
        company_id: mlAccount.company_id,
        seller_id: sellerIdStr,
        account_name: accountName,
        meli_account_url: accountUrl,
        active: true
      },
      { onConflict: "id" }
    );

    if (updateError) {
      console.error("[ml-auth-callback] update_error_detail:", JSON.stringify(updateError));
      throw new Error(`update_failed: ${updateError.message} code:${updateError.code}`);
    }

    await deleteMlOAuthState(state);

    if (inviteIdFromState && user?.id) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("ml_account_invites")
        .update({ status: "connected", used_at: nowIso })
        .eq("id", inviteIdFromState);

      await supabase.from("user_account_access").upsert(
        {
          user_id: user.id,
          ml_account_id: mlAccountId,
          access_type: "manager",
          ops_access_enabled: false
        },
        { onConflict: "user_id,ml_account_id,access_type" }
      );

      await supabase.from("users_v2").update({ company_id: mlAccount.company_id }).eq("id", user.id).is("company_id", null);

      const successUrl = new URL("/connect/ml/success", request.url);
      console.info(`${callbackTag} redirect_invite_success`, { redirectTo: successUrl.toString() });
      return NextResponse.redirect(successUrl);
    }

    const internalUrl = new URL(`/internal/clients/${mlAccount.company_id}`, request.url);
    internalUrl.searchParams.set("ml_connected", "true");
    console.info(`${callbackTag} redirect_internal_success`, { redirectTo: internalUrl.toString() });
    return NextResponse.redirect(internalUrl);
  } catch (error) {
    console.error(`${callbackTag} callback_failed`, error);
    const message = error instanceof Error ? error.message : "token_exchange_failed";
    console.error(`${callbackTag} redirect_error`, {
      state,
      redirectTo: `/internal/clients?ml_error=${encodeURIComponent(message)}`
    });
    return internalClientsRedirect(request, `ml_error=${encodeURIComponent(message)}`);
  }
}
