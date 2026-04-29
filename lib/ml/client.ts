/**
 * COMPLIANCE: This is the ONLY file authorized to make HTTP requests to MercadoLibre.
 * All ML data must flow through this client. No exceptions.
 * Web scraping of MercadoLibre is prohibited by their Terms of Service and
 * will result in account suspension and DPP rejection.
 * Reference: https://developers.mercadolibre.com.ar/es_ar/buenas-practicas-para-uso-de-la-plataforma
 *
 * OAuth token exchange (authorization_code / refresh_token) uses POST to the token endpoint
 * from `lib/ml/auth.ts` per ML OAuth2 — all resource calls must use `mlFetch` below.
 */
const ML_BASE_URL = "https://api.mercadolibre.com";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 700;

/** 401/403 from ML — includes API response body when present (see mlFetch). */
export class MlAuthError extends Error {
  name = "MlAuthError";
  statusCode: number;
  responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    const body = responseBody ?? "";
    super(`ML auth failed (${statusCode}): ${body}`);
    this.statusCode = statusCode;
    this.responseBody = body;
  }
}

export class MlApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "MlApiError";
  }
}

export class MlRateLimitError extends Error {
  name = "MlRateLimitError";
  endpoint: string;
  retryAfter: number;
  attempt: number;

  constructor(
    message: string,
    context: { endpoint: string; retryAfter: number; attempt: number }
  ) {
    super(message);
    this.endpoint = context.endpoint;
    this.retryAfter = context.retryAfter;
    this.attempt = context.attempt;
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
      const token = options?.token?.trim();
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        cache: "no-store"
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterRaw = Number.parseInt(retryAfterHeader ?? "2", 10);
        const retryAfterSeconds = Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? retryAfterRaw : 2;
        const retryMs = retryAfterSeconds * 1000;
        console.error("[ml-client:rate_limited]", {
          endpoint: path,
          retryAfter: retryAfterSeconds,
          attempt: attempt + 1
        });
        if (attempt >= MAX_RETRIES - 1) {
          throw new MlRateLimitError("ML API rate limit exceeded after maximum retries", {
            endpoint: path,
            retryAfter: retryAfterSeconds,
            attempt: attempt + 1
          });
        }
        await sleep(retryMs);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        const body = await response.text();
        throw new MlAuthError(response.status, body);
      }

      if (!response.ok) {
        const body = await response.text();
        throw new MlApiError(`ML API error ${response.status}: ${body}`, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MlAuthError) throw error;
      if (error instanceof MlRateLimitError) throw error;
      lastError = error instanceof Error ? error : new Error("Unknown ML request error");

      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`ML API request failed after ${MAX_RETRIES} retries`);
}
