import { describe, expect, it, vi, afterEach } from "vitest";
import { mlFetch, MlRateLimitError } from "@/lib/ml/client";

describe("mlFetch 429 + Retry-After", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws MlRateLimitError after 3 consecutive 429 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 429,
      headers: { get: (h: string) => (h === "Retry-After" ? "0" : null) },
      json: async () => ({})
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(mlFetch("/test", { token: "t" })).rejects.toBeInstanceOf(MlRateLimitError);
    const err = await mlFetch("/test2", { token: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(MlRateLimitError);
    if (err instanceof MlRateLimitError) {
      expect(err.endpoint).toBe("/test2");
      expect(err.attempt).toBe(3);
    }
    expect(fetchMock).toHaveBeenCalled();
  });
});
