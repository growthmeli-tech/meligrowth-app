import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveSessionTokens } from "@/lib/ml/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function internalClientsRedirect(request: Request, search: string) {
  return NextResponse.redirect(new URL(`/internal/clients?${search}`, request.url));
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
    console.error(`${callbackTag} invalid_state`, { state });
    return internalClientsRedirect(request, "ml_error=invalid_state");
  }

  if (oauthError) {
    console.error(`${callbackTag} oauth_error`, { oauthError, state });
    return internalClientsRedirect(request, `ml_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    console.error(`${callbackTag} missing_code`, { state });
    return internalClientsRedirect(request, "ml_error=missing_code");
  }

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

    const supabase = await createServerSupabaseClient();
    const { data: mlAccount, error: mlAccountError } = await supabase
      .from("ml_accounts")
      .select("id, company_id")
      .eq("id", state)
      .maybeSingle();
    if (mlAccountError || !mlAccount) {
      console.error(`${callbackTag} ml_account_lookup_failed`, { state, error: mlAccountError?.message });
      throw new Error("Invalid callback state");
    }
    console.info(`${callbackTag} ml_account_lookup_ok`, {
      mlAccountId: mlAccount.id,
      companyId: mlAccount.company_id
    });

    const storagePath = `${state}/session.json`;
    const tokenPayload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
    };

    console.info(`${callbackTag} saving_tokens`, { storagePath, mlAccountId: state });
    await saveSessionTokens(storagePath, tokenPayload);
    console.info(`${callbackTag} tokens_saved`, { storagePath, mlAccountId: state });

    const { error: updateError } = await supabase.from("ml_accounts").update({ seller_id: String(tokens.user_id) }).eq("id", state);
    if (updateError) {
      console.error(`${callbackTag} seller_update_failed`, { state, error: updateError.message });
      throw new Error("Could not update ml_accounts.seller_id");
    }
    console.info(`${callbackTag} seller_updated`, { mlAccountId: state, sellerId: String(tokens.user_id) });

    const finalRedirectUrl = new URL(`/internal/clients/${mlAccount.company_id}?ml_connected=true`, request.url);
    console.info(`${callbackTag} redirect_success`, {
      companyId: mlAccount.company_id,
      redirectTo: finalRedirectUrl.toString()
    });
    return NextResponse.redirect(finalRedirectUrl);
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
