import { mlFetch } from "@/lib/ml/client";
import type { MlSellerReputationResponse, MlUserResponse } from "@/lib/ml/mappers/types";

const asPercent = (value: number | undefined) => (typeof value === "number" ? value * 100 : null);

/**
 * GET /users/{sellerId} y devuelve solo `seller_reputation` (el endpoint
 * `/users/{id}/seller_reputation` puede responder 403 con tokens de app).
 */
export async function getSellerReputation(
  sellerId: string,
  accessToken: string
): Promise<MlSellerReputationResponse | null> {
  const user = await mlFetch<MlUserResponse>(`/users/${sellerId}`, { token: accessToken });
  return user.seller_reputation ?? null;
}

export function mapReputationToDiagnostic(reputation: MlSellerReputationResponse | null | undefined) {
  const metrics = reputation?.metrics;
  const claimsRate = metrics?.claims?.rate;
  const cancellationsRate = metrics?.cancellations?.rate;
  const delayedRate = metrics?.delayed_handling_time?.rate;

  return {
    reclamos: asPercent(claimsRate),
    mediaciones: asPercent(reputation?.transactions?.ratings?.negative),
    cancelaciones_vendedor: asPercent(cancellationsRate),
    envios_a_tiempo: typeof delayedRate === "number" ? (1 - delayedRate) * 100 : null
  };
}
