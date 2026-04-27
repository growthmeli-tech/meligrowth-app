import { getServerEnv } from "@/lib/config/env";

export function getMLAuthorizationUrl(mlAccountId: string): string {
  const { ml } = getServerEnv();
  if (!ml.clientId || !ml.redirectUri) {
    throw new Error("ML credentials not configured");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: ml.clientId,
    redirect_uri: ml.redirectUri,
    state: mlAccountId
  });

  return `https://auth.mercadolibre.com.ar/authorization?${params.toString()}`;
}
