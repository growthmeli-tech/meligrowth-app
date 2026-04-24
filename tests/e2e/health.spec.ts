import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function getCronSecret() {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return undefined;

  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("CRON_SECRET="));

  return line ? line.slice("CRON_SECRET=".length) : undefined;
}

test("internal health endpoint reports runtime readiness", async ({ request }) => {
  const cronSecret = getCronSecret();
  const response = await request.get("/api/internal/health", {
    headers: cronSecret ? { "x-cron-secret": cronSecret } : undefined
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  expect(body).toMatchObject({
    ok: true,
    checks: expect.any(Object),
    readiness: expect.any(Object)
  });
  expect(["ok", "not_configured"]).toContain(body.database);
  expect(body.readiness.total).toBeGreaterThan(0);
  expect(body.timestamp).toEqual(expect.any(String));
});
