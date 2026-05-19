import { headers } from "next/headers";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function originFromHost(host: string, proto = "https"): string | null {
  const normalizedHost = host.split(",")[0]?.trim();
  if (!normalizedHost) return null;
  return stripTrailingSlash(`${proto}://${normalizedHost}`);
}

function getVercelDeploymentOrigin(): string | null {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) return null;
  const host = vercelUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return host ? `https://${host}` : null;
}

function getPreviewAppUrl(): string | null {
  return getVercelDeploymentOrigin();
}

/** Canonical public origin for invite links (no trailing slash). */
export function getAppUrl(): string {
  if (process.env.VERCEL_ENV === "preview") {
    const previewOrigin = getPreviewAppUrl();
    if (previewOrigin) return previewOrigin;
  }

  const raw = process.env.APP_URL?.trim();
  if (!raw) return "";
  return stripTrailingSlash(raw);
}

/** Request-aware origin for server actions; prefers current host on Preview. */
export async function getRequestAppUrl(): Promise<string> {
  if (process.env.VERCEL_ENV === "preview") {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      if (host) {
        const origin = originFromHost(host, h.get("x-forwarded-proto") ?? "https");
        if (origin) return origin;
      }
    } catch {
      // headers() is unavailable outside a request scope
    }

    const previewOrigin = getPreviewAppUrl();
    if (previewOrigin) return previewOrigin;
  }

  return getAppUrl();
}
