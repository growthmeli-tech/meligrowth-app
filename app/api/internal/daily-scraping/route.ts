import { NextResponse } from "next/server";
import { runDailyScrapingDispatch } from "@/lib/scraping/daily-dispatch";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dispatch = body.dispatch !== false;
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  const result = await runDailyScrapingDispatch({ dispatch, clientId, useServiceRole: true });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
