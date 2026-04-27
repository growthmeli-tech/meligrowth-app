import { describe, expect, it, vi } from "vitest";
import { getInternalDashboardCompanies } from "@/lib/data-v2/dashboard-internal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createMockAccountHealth,
  createMockCompany,
  createMockMLAccount
} from "@/tests/helpers/factories";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(resolve)
  };
  return builder;
}

function createDashboardSupabaseMock() {
  const companies = [
    createMockCompany({ id: "company-360", plan: "360", name: "Empresa 360" }),
    createMockCompany({ id: "company-copilot", plan: "360_copilot", name: "Empresa Copilot" })
  ];
  const accounts = [
    createMockMLAccount({ id: "account-360", company_id: "company-360" }),
    createMockMLAccount({ id: "account-copilot", company_id: "company-copilot" })
  ];
  const healthRows = [
    createMockAccountHealth({ id: "health-360", ml_account_id: "account-360", score_global: 71 }),
    createMockAccountHealth({ id: "health-copilot", ml_account_id: "account-copilot", score_global: 58 })
  ];

  const responsesByTable: Record<string, { data: unknown; error: unknown }> = {
    companies: { data: companies, error: null },
    ml_accounts: { data: accounts, error: null },
    account_health: { data: healthRows, error: null },
    alerts: { data: [], error: null },
    tasks: { data: [], error: null }
  };

  return {
    from: vi.fn((table: string) => createThenableBuilder(responsesByTable[table] ?? { data: [], error: null }))
  };
}

describe("dashboard interno v2", () => {
  it("el filtro del dashboard interno distingue correctamente 360 y Copilot", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(createDashboardSupabaseMock() as never);

    const result = await getInternalDashboardCompanies();

    expect(result.success).toBe(true);
    if (result.success) {
      const plans = new Set(result.data.map((item) => item.company.plan));
      expect(plans.has("360")).toBe(true);
      expect(plans.has("360_copilot")).toBe(true);

      const only360 = result.data.filter((item) => item.company.plan === "360");
      const onlyCopilot = result.data.filter((item) => item.company.plan === "360_copilot");
      expect(only360).toHaveLength(1);
      expect(onlyCopilot).toHaveLength(1);
    }
  });
});
