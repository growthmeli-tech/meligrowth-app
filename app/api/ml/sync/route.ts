import { NextRequest, NextResponse } from "next/server";
import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  const mlAccountId = typeof body.ml_account_id === "string" ? body.ml_account_id : null;
  if (!clientId && !mlAccountId) {
    return NextResponse.json({ success: false, error: "client_id o ml_account_id requerido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Supabase no configurado" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let result:
    | Awaited<ReturnType<typeof fetchMLDiagnosticData>>
    | { success: false; error: string };

  if (mlAccountId) {
    const { data: mlAccount, error: mlAccountError } = await supabase
      .from("ml_accounts")
      .select("id, seller_id, company_id")
      .eq("id", mlAccountId)
      .maybeSingle();

    if (mlAccountError || !mlAccount) {
      return NextResponse.json({ success: false, error: "Cuenta ML no encontrada" }, { status: 404 });
    }

    if (!mlAccount.seller_id) {
      return NextResponse.json(
        { success: false, error: "La cuenta ML no tiene seller_id configurado" },
        { status: 400 }
      );
    }

    const sessionClientId = clientId ?? mlAccount.company_id;
    result = await fetchMLDiagnosticData(sessionClientId, mlAccount.seller_id, { mlAccountId: mlAccount.id });
  } else {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, meli_seller_id")
      .eq("id", clientId as string)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    if (!client.meli_seller_id) {
      return NextResponse.json(
        { success: false, error: "Este cliente no tiene cuenta de Mercado Libre conectada" },
        { status: 400 }
      );
    }

    result = await fetchMLDiagnosticData(client.id, client.meli_seller_id);
  }

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
