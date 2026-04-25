import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/ml/auth";
import { encryptJsonString, isAppEncryptionConfigured } from "@/lib/security/encryption";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

function settingsRedirect(request: NextRequest, clientId: string, search: string) {
  return NextResponse.redirect(new URL(`/operator/clients/${clientId}/settings?${search}`, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (!state) {
    return NextResponse.redirect(new URL("/operator/dashboard?ml_error=invalid_state", request.url));
  }

  if (oauthError) {
    return settingsRedirect(request, state, `ml_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return settingsRedirect(request, state, "ml_error=missing_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.user_id) {
      throw new Error("Missing user_id in ML token response");
    }

    const supabase = createServiceSupabaseClient();
    const { data: client } = await supabase.from("clients").select("id").eq("id", state).maybeSingle();
    if (!client) {
      throw new Error("Invalid callback state");
    }

    const storagePath = `${state}/${tokens.user_id}/oauth-session.json`;
    const tokenPayload = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      seller_id: String(tokens.user_id)
    };

    const rawPayload = JSON.stringify(tokenPayload);
    const storedPayload = isAppEncryptionConfigured() ? encryptJsonString(rawPayload) : rawPayload;
    const { error: uploadError } = await supabase.storage.from("meli-sessions").upload(storagePath, storedPayload, {
      upsert: true,
      contentType: "application/json",
      cacheControl: "3600"
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    await supabase.from("meli_sessions").upsert({
      client_id: state,
      seller_id: String(tokens.user_id),
      storage_path: storagePath,
      status: "validated",
      source: "oauth",
      warnings: [],
      last_error: null,
      last_validated_at: new Date().toISOString(),
      created_by: null
    });

    await supabase.from("clients").update({ meli_seller_id: String(tokens.user_id) }).eq("id", state);

    return settingsRedirect(request, state, "ml_connected=true");
  } catch (error) {
    console.error("[ml-auth-callback]", error);
    return settingsRedirect(request, state, "ml_error=token_exchange_failed");
  }
}
