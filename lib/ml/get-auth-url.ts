import { getAuthorizationUrl } from "@/lib/ml/auth";
import { getServerEnv } from "@/lib/config/env";
import { createMlOAuthState } from "@/lib/ml/oauth-state";

/** Builds ML OAuth URL with a cryptographically random `state` stored short-lived in DB (CSRF). */
export async function getMLAuthorizationUrl(mlAccountId: string): Promise<string> {
  const { ml } = getServerEnv();
  if (!ml.clientId || !ml.redirectUri) {
    throw new Error("ML credentials not configured");
  }

  const state = await createMlOAuthState(mlAccountId);
  return getAuthorizationUrl(state);
}
