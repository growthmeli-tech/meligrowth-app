import { decryptJsonString, encryptJsonString, isAppEncryptionConfigured } from "@/lib/security/encryption";
import { getServerEnv } from "@/lib/config/env";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";
import type { MlStoredTokens, MlTokenResponse } from "@/lib/ml/mappers/types";

const ML_AUTH_URL = "https://auth.mercadolibre.com.ar/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const REFRESH_MARGIN_SECONDS = 300;

function normalizeStoredTokens(tokens: Partial<MlStoredTokens>): MlStoredTokens {
  if (!tokens.access_token || !tokens.refresh_token || typeof tokens.expires_at !== "number") {
    throw new Error("Invalid ML session payload in storage");
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at
  };
}

function assertMlCredentials() {
  const { ml } = getServerEnv();
  const clientId = ml.clientId;
  const clientSecret = ml.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Missing ML_CLIENT_ID or ML_CLIENT_SECRET");
  }

  return { clientId, clientSecret };
}

export function getAuthorizationUrl(state: string) {
  const { ml } = getServerEnv();
  const clientId = ml.clientId;
  const redirectUri = ml.redirectUri;

  if (!clientId || !redirectUri) {
    throw new Error("Missing ML_CLIENT_ID or ML_REDIRECT_URI");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state
  });

  return `${ML_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<MlTokenResponse> {
  const { clientId, clientSecret } = assertMlCredentials();
  const {
    ml: { redirectUri }
  } = getServerEnv();
  if (!redirectUri) throw new Error("Missing ML_REDIRECT_URI");

  const response = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ML OAuth exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as MlTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<MlTokenResponse> {
  const { clientId, clientSecret } = assertMlCredentials();

  const response = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ML token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as MlTokenResponse;
}

async function readSessionTokens(storagePath: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from("meli-sessions").download(storagePath);
  if (error || !data) {
    throw new Error(`Could not download meli session (${storagePath})`);
  }

  const raw = await data.text();
  const decrypted = decryptJsonString(raw);
  return normalizeStoredTokens(JSON.parse(decrypted) as Partial<MlStoredTokens>);
}

export async function saveSessionTokens(storagePath: string, tokens: MlStoredTokens) {
  const canonicalTokens = normalizeStoredTokens(tokens);
  const rawPayload = JSON.stringify(canonicalTokens);
  if (!isAppEncryptionConfigured()) {
    throw new Error("APP_ENCRYPTION_KEY is required to store ML session tokens");
  }

  let storedPayload: string;
  try {
    storedPayload = encryptJsonString(rawPayload);
  } catch {
    throw new Error("Could not encrypt ML session tokens");
  }

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from("meli-sessions").upload(storagePath, storedPayload, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "3600"
  });

  if (error) {
    throw new Error(`Could not update meli session (${storagePath})`);
  }
}

export async function getValidAccessToken(clientId: string, mlAccountId?: string) {
  const supabase = createServiceClient();

  if (mlAccountId) {
    const storagePath = `${mlAccountId}/session.json`;
    const currentTokens = await readSessionTokens(storagePath);
    const now = Math.floor(Date.now() / 1000);
    const shouldRefresh = now >= currentTokens.expires_at - REFRESH_MARGIN_SECONDS;

    if (!shouldRefresh) {
      return currentTokens.access_token;
    }

    const refreshed = await refreshAccessToken(currentTokens.refresh_token);
    const mergedTokens: MlStoredTokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? currentTokens.refresh_token,
      expires_at: now + refreshed.expires_in
    };

    try {
      await saveSessionTokens(storagePath, mergedTokens);
    } catch (err) {
      console.error("[ml-auth:refresh_lost]", {
        mlAccountId,
        storagePath,
        mode: "ml_account",
        error: err instanceof Error ? err.message : String(err)
      });
      throw err;
    }
    return mergedTokens.access_token;
  }

  const { data: session, error } = await supabase
    .from("meli_sessions")
    .select("id, storage_path")
    .eq("client_id", clientId)
    .eq("status", "validated")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !session) {
    throw new Error(`No validated ML session for client ${clientId}`);
  }

  const currentTokens = await readSessionTokens(session.storage_path);
  const now = Math.floor(Date.now() / 1000);
  const shouldRefresh = now >= currentTokens.expires_at - REFRESH_MARGIN_SECONDS;

  if (!shouldRefresh) {
    return currentTokens.access_token;
  }

  const refreshed = await refreshAccessToken(currentTokens.refresh_token);
  const mergedTokens: MlStoredTokens = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? currentTokens.refresh_token,
    expires_at: now + refreshed.expires_in
  };

  try {
    await saveSessionTokens(session.storage_path, mergedTokens);
  } catch (err) {
    console.error("[ml-auth:refresh_lost]", {
      storagePath: session.storage_path,
      mode: "legacy_client",
      meliSessionId: session.id,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
  await supabase
    .from("meli_sessions")
    .update({
      status: "validated",
      last_validated_at: new Date().toISOString(),
      last_error: null
    })
    .eq("id", session.id);

  return mergedTokens.access_token;
}
