import { describe, expect, it } from "vitest";
import {
  deriveSellerReputationStateFromPersistedAccount,
  formatSellerReputationStateForOps,
  resolveSellerReputationState
} from "@/lib/pricing/seller-reputation-state";

describe("resolveSellerReputationState (GET /users)", () => {
  it("seller_reputation null → unknown", () => {
    expect(resolveSellerReputationState(null)).toBe("unknown");
    expect(resolveSellerReputationState(undefined)).toBe("unknown");
  });

  it("exists + level_id null + power null → no_reputation", () => {
    expect(resolveSellerReputationState({ level_id: null, power_seller_status: null })).toBe("no_reputation");
  });

  it("exists + level_id present → rated", () => {
    expect(resolveSellerReputationState({ level_id: "yellow", power_seller_status: null })).toBe("rated");
  });
});

describe("deriveSellerReputationStateFromPersistedAccount", () => {
  it("synced_at null → unknown", () => {
    expect(deriveSellerReputationStateFromPersistedAccount(null, null, null)).toBe("unknown");
    expect(deriveSellerReputationStateFromPersistedAccount("", "green", null)).toBe("unknown");
  });

  it("synced + level null + power null → no_reputation", () => {
    expect(deriveSellerReputationStateFromPersistedAccount("2026-01-01", null, null)).toBe("no_reputation");
  });

  it("synced + any tier field → rated", () => {
    expect(deriveSellerReputationStateFromPersistedAccount("2026-01-01", "yellow", null)).toBe("rated");
  });
});

describe("formatSellerReputationStateForOps", () => {
  it("labels sin técnico ni null", () => {
    expect(formatSellerReputationStateForOps("unknown", null)).toBe("falta reputación ML");
    expect(formatSellerReputationStateForOps("no_reputation", null)).toBe("sin reputación");
    expect(formatSellerReputationStateForOps("rated", "yellow")).toBe("amarilla");
  });
});
