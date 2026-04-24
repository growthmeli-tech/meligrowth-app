import { NextResponse } from "next/server";
import { consolidateAllScrapingClients, consolidateScrapingClient } from "@/lib/diagnostics/consolidate-scraping";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  const result = clientId ? await consolidateScrapingClient(clientId) : await consolidateAllScrapingClients();

  return NextResponse.json(result);
}
