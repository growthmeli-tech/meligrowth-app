import "server-only";

import { mlFetch } from "@/lib/ml/client";
import type { MlUserResponse } from "@/lib/ml/mappers/types";

export type MlSellerReputationRaw = {
  level_id?: string | null;
  power_seller_status?: string | null;
};

/**
 * GET /users/{USER_ID} — seller reputation fields only (no client usage).
 */
export async function getSellerReputation(
  userId: string,
  accessToken: string
): Promise<MlSellerReputationRaw | null> {
  const user = await mlFetch<MlUserResponse>(`/users/${userId}`, { token: accessToken });
  const sr = user.seller_reputation;
  if (!sr) return null;
  return {
    level_id: sr.level_id ?? null,
    power_seller_status: sr.power_seller_status ?? null
  };
}
