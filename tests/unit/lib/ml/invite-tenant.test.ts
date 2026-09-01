import { describe, expect, it } from "vitest";
import { inviteUserCompanyAllowed } from "@/lib/ml/invite-tenant";

describe("inviteUserCompanyAllowed", () => {
  it("allows users with no company yet (fresh invite registration)", () => {
    expect(inviteUserCompanyAllowed(null, "co-b")).toBe(true);
    expect(inviteUserCompanyAllowed(undefined, "co-b")).toBe(true);
  });

  it("allows existing users of the invited company", () => {
    expect(inviteUserCompanyAllowed("co-b", "co-b")).toBe(true);
  });

  it("rejects existing users of a different company", () => {
    expect(inviteUserCompanyAllowed("co-a", "co-b")).toBe(false);
  });
});
