import { NextRequest, NextResponse } from "next/server";
import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const syncTag = "[ml-sync]";
  const body = await request.json().catch(() => ({}));
  const mlAccountId = typeof body.ml_account_id === "string" ? body.ml_account_id : null;
  console.info(`${syncTag} incoming`, {
    hasMlAccountId: Boolean(mlAccountId),
    bodyKeys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : []
  });

  if (!mlAccountId) {
    console.error(`${syncTag} missing_ml_account_id`);
    return NextResponse.json({ success: false, error: "ml_account_id requerido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    console.error(`${syncTag} supabase_not_configured`);
    return NextResponse.json({ success: false, error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    console.error(`${syncTag} unauthorized`);
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = createServiceClient();
  const { data: mlAccount, error: mlAccountError } = await serviceSupabase
    .from("ml_accounts")
    .select("id, seller_id, company_id")
    .eq("id", mlAccountId)
    .maybeSingle();

  if (mlAccountError || !mlAccount) {
    console.error(`${syncTag} ml_account_lookup_failed`, { mlAccountId, error: mlAccountError?.message });
    return NextResponse.json({ success: false, error: "Cuenta ML no encontrada" }, { status: 404 });
  }

  console.info(`${syncTag} ml_account_lookup_ok`, {
    mlAccountId: mlAccount.id,
    companyId: mlAccount.company_id,
    hasSellerId: Boolean(mlAccount.seller_id)
  });

  if (!mlAccount.seller_id) {
    console.error(`${syncTag} missing_seller_id`, { mlAccountId: mlAccount.id });
    return NextResponse.json(
      { success: false, error: "La cuenta ML no tiene seller_id configurado" },
      { status: 400 }
    );
  }

  console.info(`${syncTag} fetching_pipeline_data`, {
    mlAccountId: mlAccount.id,
    companyId: mlAccount.company_id
  });
  const result = await fetchMLDiagnosticData(mlAccount.company_id, mlAccount.seller_id, { mlAccountId: mlAccount.id });

  if (!result.success) {
    console.error(`${syncTag} pipeline_failed`, { mlAccountId: mlAccount.id, error: result.error });
    return NextResponse.json(result, { status: 400 });
  }

  console.info(`${syncTag} pipeline_success`, {
    mlAccountId: mlAccount.id,
    dataSources: result.data.data_sources
  });
  return NextResponse.json(result);
}
