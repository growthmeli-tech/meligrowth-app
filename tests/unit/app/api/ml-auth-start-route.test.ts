import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: vi.fn()
}));
vi.mock("@/lib/ml/oauth-state", () => ({
  createMlOAuthState: vi.fn()
}));
vi.mock("@/lib/ml/auth", () => ({
  getAuthorizationUrl: vi.fn()
}));
vi.mock("@/lib/data-v2/internal-team", () => ({
  requireMeliGrowthTeam: vi.fn()
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/ml/auth/start/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createMlOAuthState } from "@/lib/ml/oauth-state";
import { getAuthorizationUrl } from "@/lib/ml/auth";
import { requireMeliGrowthTeam } from "@/lib/data-v2/internal-team";

describe("GET /api/ml/auth/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires ml_account_id for internal reconnect", async () => {
    vi.mocked(requireMeliGrowthTeam).mockResolvedValue({ success: true, data: { userId: "int-1" } });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "int-1" } }, error: null }) }
    } as never);

    const req = new NextRequest("https://app.local/api/ml/auth/start");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("starts OAuth for internal reconnect when ml_account_id is valid", async () => {
    vi.mocked(requireMeliGrowthTeam).mockResolvedValue({ success: true, data: { userId: "int-1" } });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "int-1" } }, error: null }) }
    } as never);

    const fromMock = vi.fn((table: string) => {
      if (table === "ml_accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "acc-1", company_id: "co-1" },
                error: null
              })
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    vi.mocked(createServiceSupabaseClient).mockReturnValue({ from: fromMock } as never);
    vi.mocked(createMlOAuthState).mockResolvedValue("state-1");
    vi.mocked(getAuthorizationUrl).mockReturnValue("https://auth.meli.local?state=state-1");

    const req = new NextRequest("https://app.local/api/ml/auth/start?ml_account_id=acc-1");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(createMlOAuthState).toHaveBeenCalledWith("acc-1");
  });
});
