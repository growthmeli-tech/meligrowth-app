import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/encryption", () => ({
  decryptJsonString: vi.fn((payload: string) => payload),
  encryptJsonString: vi.fn(),
  isAppEncryptionConfigured: vi.fn()
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: vi.fn()
}));

import { getAuthorizationUrl, refreshAccessToken, saveSessionTokens } from "@/lib/ml/auth";
import { encryptJsonString, isAppEncryptionConfigured } from "@/lib/security/encryption";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

function mockStorageUpload() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    storage: {
      from: vi.fn(() => ({ upload }))
    }
  } as never);
  return upload;
}

describe("ML auth", () => {
  beforeEach(() => {
    process.env.ML_CLIENT_ID = "client-id";
    process.env.ML_CLIENT_SECRET = "client-secret";
    process.env.ML_REDIRECT_URI = "https://app.local/callback";
    vi.clearAllMocks();
    vi.mocked(isAppEncryptionConfigured).mockReturnValue(true);
    vi.mocked(encryptJsonString).mockReturnValue("{\"v\":1,\"data\":\"encrypted\"}");
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

  it("saveSessionTokens falla cerrado si falta APP_ENCRYPTION_KEY", async () => {
    vi.mocked(isAppEncryptionConfigured).mockReturnValue(false);
    const upload = mockStorageUpload();

    await expect(
      saveSessionTokens("acc-1/session.json", {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 123
      })
    ).rejects.toThrow("APP_ENCRYPTION_KEY is required");

    expect(encryptJsonString).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("saveSessionTokens persiste solo payload cifrado cuando el cifrado funciona", async () => {
    vi.mocked(encryptJsonString).mockReturnValue("encrypted-session-payload");
    const upload = mockStorageUpload();

    await saveSessionTokens("acc-1/session.json", {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_at: 123
    });

    expect(encryptJsonString).toHaveBeenCalledWith(
      JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 123
      })
    );
    expect(upload).toHaveBeenCalledWith("acc-1/session.json", "encrypted-session-payload", {
      upsert: true,
      contentType: "application/json",
      cacheControl: "3600"
    });
  });

  it("saveSessionTokens falla cerrado si el cifrado falla", async () => {
    vi.mocked(encryptJsonString).mockImplementation(() => {
      throw new Error("raw crypto details");
    });
    const upload = mockStorageUpload();

    await expect(
      saveSessionTokens("acc-1/session.json", {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 123
      })
    ).rejects.toThrow("Could not encrypt ML session tokens");

    await expect(
      saveSessionTokens("acc-1/session.json", {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 123
      })
    ).rejects.not.toThrow("raw crypto details");
    expect(upload).not.toHaveBeenCalled();
  });

  it("saveSessionTokens nunca persiste tokens planos", async () => {
    vi.mocked(encryptJsonString).mockReturnValue("encrypted-session-payload");
    const upload = mockStorageUpload();

    await saveSessionTokens("acc-1/session.json", {
      access_token: "plain-access-token",
      refresh_token: "plain-refresh-token",
      expires_at: 123
    });

    const storedPayload = upload.mock.calls[0]?.[1];
    expect(storedPayload).toBe("encrypted-session-payload");
    expect(storedPayload).not.toContain("plain-access-token");
    expect(storedPayload).not.toContain("plain-refresh-token");
  });

  it("saveSessionTokens no persiste payload invalido", async () => {
    const upload = mockStorageUpload();

    await expect(
      saveSessionTokens("acc-1/session.json", {
        access_token: "",
        refresh_token: "refresh-token",
        expires_at: 123
      })
    ).rejects.toThrow("Invalid ML session payload");

    expect(encryptJsonString).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
