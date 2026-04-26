import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthorizationUrl, refreshAccessToken } from "@/lib/ml/auth";

describe("ML auth", () => {
  beforeEach(() => {
    process.env.ML_CLIENT_ID = "client-id";
    process.env.ML_CLIENT_SECRET = "client-secret";
    process.env.ML_REDIRECT_URI = "https://app.local/callback";
    vi.restoreAllMocks();
  });

  it("construye authorization url con response_type=code", () => {
    const url = getAuthorizationUrl("state-123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=client-id");
    expect(url).toContain("state=state-123");
  });

  it("refreshAccessToken llama oauth/token con grant refresh_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-token",
        refresh_token: "new-refresh",
        expires_in: 21600
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshAccessToken("old-refresh");
    expect(result.access_token).toBe("new-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadolibre.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          toString: expect.any(Function)
        })
      })
    );
  });

  it("refreshAccessToken lanza error si ML responde no-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Unauthorized"
      })
    );

    await expect(refreshAccessToken("bad-token")).rejects.toThrow(/refresh failed/i);
  });
});
