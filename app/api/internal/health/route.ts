import { NextResponse } from "next/server";
import { getRuntimeReadiness, isParserPipelineConfigured, isScraperPipelineConfigured, isSupabaseConfigured, isSupabaseServiceConfigured } from "@/lib/supabase/config";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const checks = {
    supabasePublic: isSupabaseConfigured(),
    supabaseService: isSupabaseServiceConfigured(),
    parser: isParserPipelineConfigured(),
    scraper: isScraperPipelineConfigured(),
    resend: Boolean(process.env.RESEND_API_KEY)
  };
  const readiness = getRuntimeReadiness();

  let database = "not_configured";
  if (isSupabaseServiceConfigured()) {
    try {
      const supabase = createServiceSupabaseClient();
      const { error } = await supabase.from("clients").select("id", { count: "exact", head: true });
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }

  return NextResponse.json({
    ok: database !== "error",
    database,
    checks,
    readiness,
    timestamp: new Date().toISOString()
  });
}
