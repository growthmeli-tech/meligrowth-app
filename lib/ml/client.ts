const ML_BASE_URL = "https://api.mercadolibre.com";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 700;

export class MlAuthError extends Error {
  name = "MlAuthError";
}

export class MlApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "MlApiError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MlFetchOptions = RequestInit & {
  token?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function withQuery(path: string, query?: MlFetchOptions["query"]) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}${path.includes("?") ? "&" : "?"}${queryString}` : path;
}

export async function mlFetch<T>(path: string, options?: MlFetchOptions): Promise<T> {
  const url = `${ML_BASE_URL}${withQuery(path, options?.query)}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options?.headers ?? {})
        },
        cache: "no-store"
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "2", 10);
        const retryMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 2000;
        await sleep(retryMs);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new MlAuthError(`ML auth failed (${response.status})`);
      }

      if (!response.ok) {
        const body = await response.text();
        throw new MlApiError(`ML API error ${response.status}: ${body}`, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MlAuthError) throw error;
      lastError = error instanceof Error ? error : new Error("Unknown ML request error");

      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`ML API request failed after ${MAX_RETRIES} retries`);
}
