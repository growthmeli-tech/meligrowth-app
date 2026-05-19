import { createHash, randomBytes } from "crypto";

/** Raw token is shown once to operators; only SHA-256 hex is persisted. */
export function generateInviteRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
