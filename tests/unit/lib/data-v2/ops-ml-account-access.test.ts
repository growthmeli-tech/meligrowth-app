import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSyncableMlAccountForUser, requireOpsMlAccountAccess } from "@/lib/data-v2/ml-accounts";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

type QueryResult = { data: unknown; error: unknown };

function createBuilder(result: QueryResult) {
  const eqs: Array<[string, unknown]> = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqs.push([column, value]);
      return builder;
    }),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve)
  };
  return { builder, eqs };
}

function mockSupabase(input: {
  userId: string | null;
  profile?: { role: string; company_id?: string | null } | null;
  account?: { id: string; company_id?: string; seller_id?: string | null } | null;
  access?: { id: string } | null;
}) {
  const usersV2 = createBuilder({ data: input.profile ?? null, error: null });
  const accounts = createBuilder({ data: input.account ?? null, error: null });
  const access = createBuilder({ data: input.access ?? null, error: null });

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: input.userId ? { id: input.userId } : null },
        error: null
      })
    },
    from: vi.fn((table: string) => {
      if (table === "users_v2") return usersV2.builder;
      if (table === "ml_accounts") return accounts.builder;
      if (table === "user_account_access") return access.builder;
      return createBuilder({ data: null, error: null }).builder;
    })
  };

  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never);
  return { client, usersV2, accounts, access };
}

describe("requireOpsMlAccountAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated sessions", async () => {
    mockSupabase({ userId: null });

    const result = await requireOpsMlAccountAccess("acc-1");

    expect(result).toEqual({ success: false, error: "Sesión inválida. Volvé a iniciar sesión." });
  });

  it("rejects client_manager even when they can read the ML account", async () => {
    const mocks = mockSupabase({
      userId: "manager-1",
      profile: { role: "client_manager", company_id: "company-1" },
      account: { id: "acc-1" },
      access: null
    });

    const result = await requireOpsMlAccountAccess("acc-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
      expect(result.error).toMatch(/permiso para operar/i);
    }
    expect(mocks.access.eqs).toEqual(
      expect.arrayContaining([
        ["user_id", "manager-1"],
        ["ml_account_id", "acc-1"],
        ["access_type", "operator"],
        ["ops_access_enabled", true]
      ])
    );
  });

  it("rejects client_operator without ops_access_enabled", async () => {
    mockSupabase({
      userId: "op-1",
      profile: { role: "client_operator", company_id: "company-1" },
      account: { id: "acc-1" },
      access: null
    });

    const result = await requireOpsMlAccountAccess("acc-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  it("allows client_operator with ops_access_enabled on this account", async () => {
    mockSupabase({
      userId: "op-1",
      profile: { role: "client_operator", company_id: "company-1" },
      account: { id: "acc-1" },
      access: { id: "uaa-1" }
    });

    const result = await requireOpsMlAccountAccess("acc-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe("op-1");
    }
  });

  it("allows internal team without an ops access row", async () => {
    const mocks = mockSupabase({
      userId: "internal-1",
      profile: { role: "internal_operator_meli_growth", company_id: null },
      account: { id: "acc-1" }
    });

    const result = await requireOpsMlAccountAccess("acc-1");

    expect(result.success).toBe(true);
    expect(mocks.client.from).not.toHaveBeenCalledWith("user_account_access");
  });
});

describe("getSyncableMlAccountForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not treat a manager access row as syncable", async () => {
    const mocks = mockSupabase({
      userId: "manager-1",
      profile: { role: "client_manager", company_id: "company-1" },
      account: { id: "acc-1", company_id: "company-1", seller_id: "seller-1" },
      access: null
    });

    const result = await getSyncableMlAccountForUser({ userId: "manager-1", mlAccountId: "acc-1" });

    expect(result).toEqual({ success: true, data: null });
    expect(mocks.access.eqs).toEqual(
      expect.arrayContaining([
        ["access_type", "operator"],
        ["ops_access_enabled", true]
      ])
    );
  });

  it("allows an ops-enabled operator in the same company", async () => {
    mockSupabase({
      userId: "op-1",
      profile: { role: "client_operator", company_id: "company-1" },
      account: { id: "acc-1", company_id: "company-1", seller_id: "seller-1" },
      access: { id: "uaa-1" }
    });

    const result = await getSyncableMlAccountForUser({ userId: "op-1", mlAccountId: "acc-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "acc-1", company_id: "company-1", seller_id: "seller-1" });
    }
  });
});
