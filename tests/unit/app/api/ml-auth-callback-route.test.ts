import { describe, expect, it, vi, beforeEach } from "vitest";

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

describe("GET /api/ml/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts GET and validates required state", async () => {
    const req = new Request("https://app.local/api/ml/auth/callback?code=test");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("stores tokens and redirects internally when no invite context", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({
      mlAccountId: "acc-123",
      inviteId: null
    });
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 21600,
      user_id: 999
    });
    vi.mocked(mlFetch).mockResolvedValue({ id: 999, nickname: "Mi Tienda", permalink: "https://meli.test/store" } as never);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "u1", email: "op@test.com" } }, error: null })
      }
    } as never);

    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        if (table === "ml_accounts") {
          return {
            select: () => ({
              eq: (col: string) => {
                if (col === "id") {
                  return {
                    maybeSingle: async () => ({ data: { id: "acc-123", company_id: "co-1" }, error: null })
                  };
                }
                if (col === "company_id") {
                  return {
                    eq: () => ({
                      neq: () => ({
                        maybeSingle: async () => ({ data: null, error: null })
                      })
                    })
                  };
                }
                return { maybeSingle: async () => ({ data: null, error: null }) };
              }
            }),
            upsert: async () => ({ error: null })
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

    const req = new Request("https://app.local/api/ml/auth/callback?code=abc&state=550e8400-e29b-41d4-a716-446655440000");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/internal/clients/co-1");
    expect(saveSessionTokens).toHaveBeenCalledTimes(1);
    expect(deleteMlOAuthState).toHaveBeenCalledTimes(1);
  });

  it("rejects invite callback when invite account does not match OAuth state before saving tokens", async () => {
    vi.mocked(peekMlOAuthState).mockResolvedValue({
      mlAccountId: "acc-state",
      inviteId: "invite-1"
    });
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 21600,
      user_id: 999
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "u1", email: "client@test.com" } }, error: null })
      }
    } as never);

    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        if (table === "ml_accounts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "acc-state", company_id: "co-1" }, error: null })
              })
            })
          };
        }
        if (table === "ml_account_invites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "invite-1",
                    ml_account_id: "acc-other",
                    client_email: "client@test.com",
                    status: "pending"
                  },
                  error: null
                })
              })
            })
          };
        }
        throw new Error(`unexpected table ${table}`);
      }
    } as never);

    const req = new Request("https://app.local/api/ml/auth/callback?code=abc&state=550e8400-e29b-41d4-a716-446655440000");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/connect/ml/error");
    expect(res.headers.get("location")).toContain("reason=invalid_invite");
    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(mlFetch).not.toHaveBeenCalled();
    expect(deleteMlOAuthState).toHaveBeenCalledTimes(1);
  });
});
