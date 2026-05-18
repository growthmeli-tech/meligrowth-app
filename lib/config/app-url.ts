/** Canonical public origin for invite links (no trailing slash). */
export function getAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}
