import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ml/auth", () => ({
  exchangeCodeForTokens: vi.fn(),
  saveSessionTokens: vi.fn()
}));
vi.mock("@/lib/ml/oauth-state", () => ({
  peekMlOAuthState: vi.fn(),
  deleteMlOAuthState: vi.fn()
}));
vi.mock("@/lib/ml/client", () => ({
  mlFetch: vi.fn()
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

import { GET } from "@/app/api/ml/auth/callback/route";
import { exchangeCodeForTokens, saveSessionTokens } from "@/lib/ml/auth";
import { deleteMlOAuthState, peekMlOAuthState } from "@/lib/ml/oauth-state";
import { mlFetch } from "@/lib/ml/client";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STATE = "550e8400-e29b-41d4-a716-446655440000";
const CALLBACK_URL = `https://app.local/api/ml/auth/callback?code=abc&state=${STATE}`;

function mockAuthUser(user: { id: string; email: string } | null = { id: "u1", email: "client@test.com" }) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user }, error: null })
    }
  } as never);
}

function mockTokens() {
  vi.mocked(exchangeCodeForTokens).mockResolvedValue({
    access_token: "at",
    refresh_token: "rt",
    expires_in: 21600,
    user_id: 999
  });
}

function mockMlProfile() {
  vi.mocked(mlFetch).mockResolvedValue({ id: 999, nickname: "Mi Tienda", permalink: "https://meli.test/store" } as never);
}

function mockInternalService(track?: { steps: string[] }) {
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === "ml_accounts") {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === "id") {
                return {
                  maybeSingle: async () => {
                    track?.steps.push("load_account");
                    return { data: { id: "acc-123", company_id: "co-1" }, error: null };
                  }
                };
              }
              if (col === "company_id") {
                return {
                  eq: () => ({
                    neq: () => ({
                      maybeSingle: async () => {
                        track?.steps.push("duplicate_check");
                        return { data: null, error: null };
                      }
                    })
                  })
                };
              }
              return { maybeSingle: async () => ({ data: null, error: null }) };
            }
          }),
          upsert: async () => {
            track?.steps.push("account_upsert");
            return { error: null };
          }
        };
      }
      if (table === "users_v2") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { role: "internal_operator_meli_growth", company_id: null },
                error: null
              })
            })
          })
        };
      }
      if (table === "user_account_access") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null })
              })
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  } as never);
}

function mockInviteService(input: { completionCode: string; steps?: string[] }) {
  const rpc = vi.fn(async () => {
    input.steps?.push("invite_rpc");
    return { data: input.completionCode, error: null };
  });
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    rpc,
    from: (table: string) => {
      if (table === "ml_accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                input.steps?.push("load_account");
                return { data: { id: "acc-state", company_id: "co-1" }, error: null };
              }
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  } as never);
  return { rpc };
}

describe("GET /api/ml/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mlFetch).mockImplementation(async () => {
      return { nickname: "Mi Tienda", permalink: "https://meli.test/store" } as never;
    });
    vi.mocked(saveSessionTokens).mockImplementation(async () => {
      return undefined;
    });
  });

  it("rejects callback without a valid state UUID", async () => {
    const res = await GET(new Request("https://app.local/api/ml/auth/callback?code=test"));
    expect(res.status).toBe(400);
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("completes internal OAuth: profile and DB update before token storage", async () => {
    const steps: string[] = [];
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-123", inviteId: null });
    mockTokens();
    mockAuthUser({ id: "u1", email: "op@test.com" });
    mockInternalService({ steps });
    vi.mocked(mlFetch).mockImplementation(async () => {
      steps.push("ml_profile");
      return { nickname: "Mi Tienda", permalink: "https://meli.test/store" } as never;
    });
    vi.mocked(saveSessionTokens).mockImplementation(async () => {
      steps.push("token_storage");
    });

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/internal/clients/co-1?ml_connected=true");
    expect(steps).toEqual(["load_account", "ml_profile", "duplicate_check", "account_upsert", "token_storage"]);
    expect(deleteMlOAuthState).toHaveBeenCalledWith(STATE);
    expect(saveSessionTokens).toHaveBeenCalledTimes(1);
  });

  it("completes invite OAuth: RPC before token storage and success redirect", async () => {
    const steps: string[] = [];
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-state", inviteId: "invite-1" });
    mockTokens();
    mockAuthUser();
    const { rpc } = mockInviteService({ completionCode: "ok", steps });
    vi.mocked(mlFetch).mockImplementation(async () => {
      steps.push("ml_profile");
      return { nickname: "Mi Tienda", permalink: "https://meli.test/store" } as never;
    });
    vi.mocked(saveSessionTokens).mockImplementation(async () => {
      steps.push("token_storage");
    });

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/connect/ml/success");
    expect(steps).toEqual(["load_account", "ml_profile", "invite_rpc", "token_storage"]);
    expect(rpc).toHaveBeenCalledWith(
      "complete_ml_account_invite_connection",
      expect.objectContaining({
        p_invite_id: "invite-1",
        p_user_id: "u1",
        p_session_email: "client@test.com",
        p_seller_id: "999",
        p_account_name: "Mi Tienda"
      })
    );
    expect(deleteMlOAuthState).not.toHaveBeenCalled();
  });

  it("maps expired invite RPC result to public error without storing tokens", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-state", inviteId: "invite-1" });
    mockTokens();
    mockAuthUser();
    mockInviteService({ completionCode: "expired_invite" });

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.local/connect/ml/error?reason=expired_invite");
    expect(saveSessionTokens).not.toHaveBeenCalled();
  });

  it("maps consumed OAuth state to invalid_invite without storing tokens", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-state", inviteId: "invite-1" });
    mockTokens();
    mockAuthUser();
    mockInviteService({ completionCode: "invalid_state" });

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=invalid_invite");
    expect(saveSessionTokens).not.toHaveBeenCalled();
  });

  it("maps duplicate seller to public error without storing tokens", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-state", inviteId: "invite-1" });
    mockTokens();
    mockAuthUser();
    mockInviteService({ completionCode: "duplicate_seller" });

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=duplicate_seller");
    expect(saveSessionTokens).not.toHaveBeenCalled();
  });

  it("returns token_persist_failed without leaking storage error details in the redirect", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({ mlAccountId: "acc-state", inviteId: "invite-1" });
    mockTokens();
    mockAuthUser();
    mockInviteService({ completionCode: "ok" });
    vi.mocked(saveSessionTokens).mockRejectedValue(new Error("storage-secret-detail"));

    const res = await GET(new Request(CALLBACK_URL));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.local/connect/ml/error?reason=token_persist_failed");
    expect(res.headers.get("location")).not.toContain("storage-secret");
  });
});
