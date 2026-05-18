import { NextRequest, NextResponse } from "next/server";
import { getSyncableMlAccountForUser } from "@/lib/data-v2/ml-accounts";
import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const syncTag = "[ml-sync]";
  const body = await request.json().catch(() => ({}));
  const rawMlAccountId = typeof body.ml_account_id === "string" ? body.ml_account_id.trim() : "";
  const mlAccountId = rawMlAccountId.length > 0 ? rawMlAccountId : null;
  console.info(`${syncTag} incoming`, { hasMlAccountId: Boolean(mlAccountId) });

  if (!mlAccountId) {
    return NextResponse.json({ success: false, error: "ml_account_id requerido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    console.error(`${syncTag} supabase_not_configured`);
    return NextResponse.json({ success: false, error: "Supabase no configurado" }, { status: 503 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountResult = await getSyncableMlAccountForUser({ userId: user.id, mlAccountId });

    if (!accountResult.success) {
      console.error(`${syncTag} account_access_validation_failed`, {
        mlAccountId,
        code: accountResult.code ?? "UNKNOWN"
      });
      return NextResponse.json({ success: false, error: "No se pudo validar la cuenta ML" }, { status: 500 });
    }

    const mlAccount = accountResult.data;
    if (!mlAccount) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    console.info(`${syncTag} ml_account_access_ok`, {
      mlAccountId: mlAccount.id,
      companyId: mlAccount.company_id,
      hasSellerId: Boolean(mlAccount.seller_id)
    });

    if (!mlAccount.seller_id) {
      return NextResponse.json(
        { success: false, error: "La cuenta ML no tiene seller_id configurado" },
        { status: 400 }
      );
    }

    const result = await fetchMLDiagnosticData(mlAccount.company_id, mlAccount.seller_id, { mlAccountId: mlAccount.id });

    if (!result.success) {
      console.error(`${syncTag} pipeline_failed`, { mlAccountId: mlAccount.id });
      return NextResponse.json(result, { status: 400 });
    }

    console.info(`${syncTag} pipeline_success`, {
      mlAccountId: mlAccount.id,
      dataSources: result.data.data_sources
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`${syncTag} unexpected_error`, {
      mlAccountId,
      error: error instanceof Error ? error.name : "UnknownError"
    });
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
