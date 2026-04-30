/**
 * Canonical ML seller reputation states (GET /users/{sellerId} + persisted account columns).
 * Deterministic only — no volume heuristics.
 */

export type SellerReputationState = "unknown" | "no_reputation" | "rated";

export type MlSellerReputationTierInput = {
  level_id?: string | null;
  power_seller_status?: string | null;
};

function normTierField(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * Rules (API object from GET /users/{sellerId}):
 * 1. seller_reputation null/undefined → unknown
 * 2. level_id null AND power_seller_status null → no_reputation
 * 3. level_id !== null → rated
 * Otherwise → unknown (no extra business branches).
 */
export function resolveSellerReputationState(
  sellerReputation: MlSellerReputationTierInput | null | undefined
): SellerReputationState {
  if (sellerReputation === null || sellerReputation === undefined) {
    return "unknown";
  }
  const levelId = normTierField(sellerReputation.level_id);
  const power = normTierField(sellerReputation.power_seller_status);
  if (levelId !== null) {
    return "rated";
  }
  if (levelId === null && power === null) {
    return "no_reputation";
  }
  return "unknown";
}

/**
 * DB-level derivation from ml_accounts columns (no new columns).
 */
export function deriveSellerReputationStateFromPersistedAccount(
  sellerReputationSyncedAt: string | null | undefined,
  sellerReputationLevel: string | null | undefined,
  sellerPowerSellerStatus: string | null | undefined
): SellerReputationState {
  if (sellerReputationSyncedAt === null || sellerReputationSyncedAt === undefined || String(sellerReputationSyncedAt).trim() === "") {
    return "unknown";
  }
  const level = normTierField(sellerReputationLevel);
  const power = normTierField(sellerPowerSellerStatus);
  if (level === null && power === null) {
    return "no_reputation";
  }
  return "rated";
}

/** OPS UI copy — no null/technical leakage (rated uses tier hint only). */
export function formatSellerReputationStateForOps(
  state: SellerReputationState,
  sellerReputationLevel: string | null | undefined
): string {
  if (state === "unknown") return "falta reputación ML";
  if (state === "no_reputation") return "sin reputación";
  return formatRatedReputationLabel(sellerReputationLevel);
}

function formatRatedReputationLabel(levelId: string | null | undefined): string {
  if (levelId === null || levelId === undefined || String(levelId).trim() === "") {
    return "reputación ML";
  }
  const s = String(levelId).toLowerCase();
  if (s.includes("red")) return "roja";
  if (s.includes("orange")) return "naranja";
  if (s.includes("yellow")) return "amarilla";
  if (s.includes("light_green")) return "verde claro";
  if (s.includes("green")) return "verde";
  return "reputación ML";
}
