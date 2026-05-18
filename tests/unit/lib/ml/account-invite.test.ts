import { describe, expect, it } from "vitest";
import { generateInviteRawToken, hashInviteToken } from "@/lib/ml/account-invite";

describe("account-invite token hashing", () => {
  it("produces stable SHA-256 hex for the same raw token", () => {
    const raw = "test-token";
    expect(hashInviteToken(raw)).toBe(hashInviteToken(raw));
    expect(hashInviteToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generateInviteRawToken yields distinct values", () => {
    const a = generateInviteRawToken();
    const b = generateInviteRawToken();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });
});
