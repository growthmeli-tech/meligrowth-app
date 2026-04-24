import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

serve(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUrl = Deno.env.get("APP_URL")?.replace(/\/$/, "");
  if (!appUrl) {
    return json({ ok: false, error: "Missing APP_URL" }, 500);
  }

  const body = await req.text();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const response = await fetch(`${appUrl}/api/internal/daily-scraping`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": Deno.env.get("CRON_SECRET") ?? ""
    },
    body: body || "{}",
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
});
