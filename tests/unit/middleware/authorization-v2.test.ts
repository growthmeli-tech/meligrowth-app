import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { middleware } from "@/middleware";
import type { UserRoleV2 } from "@/lib/types/enums";

type AccessContext = {
  plan: "360" | "360_copilot";
  ops_access_enabled: boolean;
};

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseConfig: vi.fn(() => ({
    url: "https://supabase.local",
    anonKey: "anon-key"
  }))
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn()
}));

function createRoleSupabaseMock(role: UserRoleV2 | undefined, context: AccessContext = { plan: "360", ops_access_enabled: true }) {
  const usersV2Query = {
    select: vi.fn(() => usersV2Query),
    eq: vi.fn(() => usersV2Query),
    maybeSingle: vi.fn(async () => ({ data: role ? { role } : null, error: null }))
  };

  const accessQuery = {
    select: vi.fn(() => accessQuery),
    eq: vi.fn(() => accessQuery),
    maybeSingle: vi.fn(async () => ({
      data: { ops_access_enabled: context.ops_access_enabled, ml_account_id: "ml-account-1" },
      error: null
    }))
  };

  const mlAccountQuery = {
    select: vi.fn(() => mlAccountQuery),
    eq: vi.fn(() => mlAccountQuery),
    maybeSingle: vi.fn(async () => ({ data: { id: "ml-account-1", company_id: "company-1" }, error: null }))
  };

  const companyQuery = {
    select: vi.fn(() => companyQuery),
    eq: vi.fn(() => companyQuery),
    maybeSingle: vi.fn(async () => ({ data: { id: "company-1", plan: context.plan }, error: null }))
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: role ? { id: "user-v2-1" } : null }
      }))
    },
    from: vi.fn((table: string) => {
      if (table === "users_v2") return usersV2Query;
      if (table === "user_account_access") return accessQuery;
      if (table === "ml_accounts") return mlAccountQuery;
      if (table === "companies") return companyQuery;
      throw new Error(`Tabla no mockeada: ${table}`);
    })
  };
}

async function runMiddleware(pathname: string, role: UserRoleV2, context?: Partial<AccessContext>) {
  const request = new NextRequest(`https://app.local${pathname}`);
  const mergedContext: AccessContext = {
    plan: context?.plan ?? "360",
    ops_access_enabled: context?.ops_access_enabled ?? true
  };
  vi.mocked(createServerClient).mockReturnValue(createRoleSupabaseMock(role, mergedContext) as never);
  return middleware(request);
}

describe("middleware autorizacion v2 por rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin_meli_growth puede acceder a /internal/", async () => {
    const response = await runMiddleware("/internal/dashboard", "super_admin_meli_growth");
    expect(response.headers.get("location")).toBeNull();
  });

  it("internal_operator_meli_growth puede acceder a /internal/", async () => {
    const response = await runMiddleware("/internal/dashboard", "internal_operator_meli_growth");
    expect(response.headers.get("location")).toBeNull();
  });

  it("client_manager solo puede acceder a /brand/", async () => {
    const response = await runMiddleware("/brand/dashboard", "client_manager");
    expect(response.headers.get("location")).toBeNull();
  });

  it("client_operator solo puede acceder a /ops/", async () => {
    const response = await runMiddleware("/ops/dashboard", "client_operator");
    expect(response.headers.get("location")).toBeNull();
  });

  it("client_manager no puede acceder a /internal/ ni /ops/", async () => {
    const internalResponse = await runMiddleware("/internal/dashboard", "client_manager");
    const opsResponse = await runMiddleware("/ops/dashboard", "client_manager");

    expect(internalResponse.headers.get("location")).toContain("/brand/dashboard");
    expect(opsResponse.headers.get("location")).toContain("/brand/dashboard");
  });

  it("client_operator no puede acceder a /internal/ ni /brand/", async () => {
    const internalResponse = await runMiddleware("/internal/dashboard", "client_operator");
    const brandResponse = await runMiddleware("/brand/dashboard", "client_operator");

    expect(internalResponse.headers.get("location")).toContain("/ops/dashboard");
    expect(brandResponse.headers.get("location")).toContain("/ops/dashboard");
  });

  it("en plan Copilot con ops_access_enabled=false, client_operator no puede acceder a /ops/", async () => {
    const response = await runMiddleware("/ops/dashboard", "client_operator", {
      plan: "360_copilot",
      ops_access_enabled: false
    });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("/brand/dashboard");
  });

  it("en plan Copilot con ops_access_enabled=true, client_operator si puede acceder a /ops/", async () => {
    const response = await runMiddleware("/ops/dashboard", "client_operator", {
      plan: "360_copilot",
      ops_access_enabled: true
    });
    expect(response.headers.get("location")).toBeNull();
  });

  it("client_operator sin ops_access_enabled no puede acceder a /ops/ aunque la company sea plan 360", async () => {
    const response = await runMiddleware("/ops/dashboard", "client_operator", {
      plan: "360",
      ops_access_enabled: false
    });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("/brand/dashboard");
  });

  it("company con plan 360_copilot bloquea /ops/ si ops_access_enabled=false", async () => {
    const response = await runMiddleware("/ops/dashboard", "client_operator", {
      plan: "360_copilot",
      ops_access_enabled: false
    });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("/brand/dashboard");
  });
});
