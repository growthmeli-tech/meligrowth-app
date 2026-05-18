import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));
vi.mock("@/lib/data-v2/ml-accounts", () => ({
  getSyncableMlAccountForUser: vi.fn()
}));
vi.mock("@/lib/ml/pipeline", () => ({
  fetchMLDiagnosticData: vi.fn()
}));

import { POST } from "@/app/api/ml/sync/route";
import { getSyncableMlAccountForUser } from "@/lib/data-v2/ml-accounts";
import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function requestWithBody(body: Record<string, unknown>) {
  return new NextRequest("https://app.local/api/ml/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function mockSession(user: { id: string } | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user }, error: null })
    }
  } as never);
}

describe("POST /api/ml/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    mockSession({ id: "user-1" });
  });

  it("returns 401 when user has no session", async () => {
    mockSession(null);

    const res = await POST(requestWithBody({ ml_account_id: "acc-1" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ success: false, error: "Unauthorized" });
    expect(getSyncableMlAccountForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when ml_account_id is missing", async () => {
    const res = await POST(requestWithBody({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: "ml_account_id requerido" });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 403 when user cannot access the ML account", async () => {
    vi.mocked(getSyncableMlAccountForUser).mockResolvedValue({ success: true, data: null });

    const res = await POST(requestWithBody({ ml_account_id: "acc-2" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ success: false, error: "Forbidden" });
    expect(getSyncableMlAccountForUser).toHaveBeenCalledWith({ userId: "user-1", mlAccountId: "acc-2" });
    expect(fetchMLDiagnosticData).not.toHaveBeenCalled();
  });

  it("allows sync when user has access to the ML account", async () => {
    vi.mocked(getSyncableMlAccountForUser).mockResolvedValue({
      success: true,
      data: { id: "acc-1", company_id: "company-1", seller_id: "seller-1" }
    });
    vi.mocked(fetchMLDiagnosticData).mockResolvedValue({
      success: true,
      data: {
        seller_id: "seller-1",
        synced_at: "2026-05-18T00:00:00.000Z",
        data_sources: {
          salud: "api",
          publicaciones: "api",
          ads: "api",
          logistica: "api",
          stock: "api"
        }
      }
    } as never);

    const res = await POST(requestWithBody({ ml_account_id: "acc-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fetchMLDiagnosticData).toHaveBeenCalledWith("company-1", "seller-1", { mlAccountId: "acc-1" });
  });

  it("returns 500 without leaking internal details on unexpected errors", async () => {
    vi.mocked(getSyncableMlAccountForUser).mockRejectedValue(new Error("database password leaked"));

    const res = await POST(requestWithBody({ ml_account_id: "acc-1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Error interno" });
    expect(JSON.stringify(body)).not.toContain("database password leaked");
    expect(fetchMLDiagnosticData).not.toHaveBeenCalled();
  });
});
