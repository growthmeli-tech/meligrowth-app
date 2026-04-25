import { mlFetch } from "@/lib/ml/client";
import type { MlSellerReputationResponse } from "@/lib/ml/mappers/types";

const asPercent = (value: number | undefined) => (typeof value === "number" ? value * 100 : null);

export async function getSellerReputation(sellerId: string, accessToken: string) {
  return mlFetch<MlSellerReputationResponse>(`/users/${sellerId}/seller_reputation`, { token: accessToken });
}

export function mapReputationToDiagnostic(reputation: MlSellerReputationResponse) {
  const delayedRate = reputation.metrics?.delayed_handling_time?.rate;

  return {
    reclamos: asPercent(reputation.metrics?.claims?.rate),
    mediaciones: asPercent(reputation.transactions?.ratings?.negative),
    cancelaciones_vendedor: asPercent(reputation.metrics?.cancellations?.rate),
    envios_a_tiempo: typeof delayedRate === "number" ? (1 - delayedRate) * 100 : null
  };
}
