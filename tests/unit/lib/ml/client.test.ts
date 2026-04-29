import { describe, expect, it, vi, afterEach } from "vitest";
import { mlFetch, MlRateLimitError } from "@/lib/ml/client";

describe("mlFetch 429 + Retry-After", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza MlRateLimitError tras 3 respuestas 429 consecutivas", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        status: 429,
        headers: { get: (h: string) => (h === "Retry-After" ? "1" : null) }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const err: unknown = await mlFetch("/users/1", { token: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(MlRateLimitError);
    if (err instanceof MlRateLimitError) {
      expect(err.attempt).toBe(3);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
