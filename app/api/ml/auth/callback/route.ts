import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveSessionTokens } from "@/lib/ml/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function internalClientsRedirect(request: NextRequest, search: string) {
  return NextResponse.redirect(new URL(`/internal/clients?${search}`, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (!state || !UUID_V4_REGEX.test(state)) {
    return internalClientsRedirect(request, "ml_error=invalid_state");
  }

  if (oauthError) {
    return internalClientsRedirect(request, `ml_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return internalClientsRedirect(request, "ml_error=missing_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.user_id) {
      throw new Error("Missing user_id in ML token response");
    }

    const supabase = await createServerSupabaseClient();
    const { data: mlAccount, error: mlAccountError } = await supabase
      .from("ml_accounts")
      .select("id, company_id")
      .eq("id", state)
      .maybeSingle();
    if (mlAccountError || !mlAccount) {
      throw new Error("Invalid callback state");
    }

    const storagePath = `${state}/session.json`;
    const tokenPayload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
    };

    await saveSessionTokens(storagePath, tokenPayload);

    const { error: updateError } = await supabase.from("ml_accounts").update({ seller_id: String(tokens.user_id) }).eq("id", state);
    if (updateError) {
      throw new Error("Could not update ml_accounts.seller_id");
    }

    return NextResponse.redirect(new URL(`/internal/clients/${mlAccount.company_id}?ml_connected=true`, request.url));
  } catch (error) {
    console.error("[ml-auth-callback]", error);
    const message = error instanceof Error ? error.message : "token_exchange_failed";
    return internalClientsRedirect(request, `ml_error=${encodeURIComponent(message)}`);
  }
}
