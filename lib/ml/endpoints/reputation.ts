import { mlFetch } from "@/lib/ml/client";
import type { MlSellerReputationResponse, MlUserResponse } from "@/lib/ml/mappers/types";

const asPercent = (value: number | undefined) => (typeof value === "number" ? value * 100 : null);

/** Rough ordering for MLA seller_reputation level_id strings (worst → best). */
const LEVEL_RANK_HINTS = ["red", "orange", "yellow", "light_green", "green"];

function levelRank(levelId: string | null | undefined): number | null {
  if (!levelId) return null;
  const lower = levelId.toLowerCase();
  let best = -1;
  for (let i = 0; i < LEVEL_RANK_HINTS.length; i += 1) {
    if (lower.includes(LEVEL_RANK_HINTS[i])) best = Math.max(best, i);
  }
  const numeric = /\b(\d+)\b/.exec(levelId);
  if (numeric) return Number.parseInt(numeric[1], 10);
  return best >= 0 ? best : null;
}

/** True when ML shows a worse internal real_level than the public level_id (protection). */
export function isRealLevelWorseThanDisplayed(
  realLevel: string | null | undefined,
  levelId: string | null | undefined
): boolean {
  if (!realLevel) return false;
  const rr = levelRank(realLevel);
  const dr = levelRank(levelId);
  if (rr === null || dr === null) return false;
  return rr < dr;
}

/** True when ML exposes worse internal tier / claims than the displayed public metrics (protection program). */
export function computeReputationProtection(reputation: MlSellerReputationResponse | null | undefined): boolean {
  if (!reputation) return false;
  const rate = reputation.metrics?.claims?.rate;
  const realRate = reputation.metrics?.claims?.excluded?.real_rate;
  if (typeof rate === "number" && typeof realRate === "number" && realRate > rate) {
    return true;
  }
  const rr = levelRank(reputation.real_level ?? undefined);
  const dr = levelRank(reputation.level_id ?? undefined);
  if (rr !== null && dr !== null && rr < dr) {
    return true;
  }
  return false;
}

/**
 * GET /users/{sellerId} → `seller_reputation` (official path; avoids seller_reputation-only endpoint quirks).
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
  const realClaimsRate = metrics?.claims?.excluded?.real_rate;
  const cancellationsRate = metrics?.cancellations?.rate;
  const delayedRate = metrics?.delayed_handling_time?.rate;

  // WARNING: ML `transactions.ratings.negative` is a negative ratings ratio — not ML mediaciones count/%.
  // We keep column `mediaciones` as legacy field name; interpret as proxy until a direct mediations endpoint exists.

  const mediacionesProxy = asPercent(reputation?.transactions?.ratings?.negative);

  let reclamosPct = asPercent(claimsRate);
  let reclamosNota: string | null = null;
  if (typeof claimsRate === "number" && typeof realClaimsRate === "number" && realClaimsRate > claimsRate) {
    reclamosNota =
      "vendedor protegido: ML muestra una tasa de reclamos públicamente menor que la tasa real del período.";
  }

  return {
    reclamos: reclamosPct,
    mediaciones: mediacionesProxy,
    cancelaciones_vendedor: asPercent(cancellationsRate),
    envios_a_tiempo: typeof delayedRate === "number" ? (1 - delayedRate) * 100 : null,
    nivel_vendedor: reputation?.power_seller_status ?? null,
    ventas_completadas_60d:
      typeof metrics?.sales?.completed === "number" ? metrics.sales.completed : null,
    periodo_reputacion: metrics?.sales?.period ?? reputation?.transactions?.period ?? null,
    reputacion_protegida: computeReputationProtection(reputation),
    reputacion_real_level: reputation?.real_level ?? null,
    reputacion_level_id: reputation?.level_id ?? null,
    vendedor_protegido_reclamos:
      typeof claimsRate === "number" && typeof realClaimsRate === "number" && realClaimsRate > claimsRate,
    reclamos_nota: reclamosNota
  };
}
