import { NextRequest, NextResponse } from "next/server";
import { fetchMLDiagnosticData } from "@/lib/ml/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  if (!clientId) {
    return NextResponse.json({ success: false, error: "client_id requerido" }, { status: 400 });
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

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, meli_seller_id")
    .eq("id", clientId)
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

  const result = await fetchMLDiagnosticData(clientId, client.meli_seller_id);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
