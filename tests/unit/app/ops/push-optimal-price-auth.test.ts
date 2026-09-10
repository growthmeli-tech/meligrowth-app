import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));
vi.mock("@/lib/ml/auth", () => ({
  getValidAccessToken: vi.fn()
}));
vi.mock("@/lib/ml/endpoints/catalog", () => ({
  pushPriceToML: vi.fn()
}));
vi.mock("@/lib/data-v2/unified-catalog.server", () => ({
  listUnifiedCatalog: vi.fn(),
  linkPricingSkuToItem: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

import { pushOptimalPriceToML } from "@/app/(ops)/ops/catalog/actions";
import { getValidAccessToken } from "@/lib/ml/auth";
import { pushPriceToML } from "@/lib/ml/endpoints/catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function mockManagerSession() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn()
  };
  builder.maybeSingle
    .mockResolvedValueOnce({ data: { role: "client_manager" }, error: null })
    .mockResolvedValueOnce({ data: { id: "acc-1" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "manager-1" } }, error: null })
    },
    from: vi.fn(() => builder)
  } as never);
}

describe("pushOptimalPriceToML authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call Mercado Libre when a brand manager invokes the action", async () => {
    mockManagerSession();

    const result = await pushOptimalPriceToML("acc-1", "MLA123", 9999);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(pushPriceToML).not.toHaveBeenCalled();
  });
});
