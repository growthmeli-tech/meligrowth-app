import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
type ScoreHistoryRow = Database["public"]["Tables"]["score_history"]["Row"];

export async function getClientLatestDiagnosticRow(clientId: string): Promise<DiagnosticRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      "id, client_id, date, score_global, estado_global, reclamos, mediaciones, cancelaciones_vendedor, envios_a_tiempo, score_salud, pubs_activas_pct, pubs_optimizadas_pct, ctr, score_publicaciones, margen_pre_ads, gasto_ads, ventas_ads, ventas_totales, acos, roas, tacos, score_ads, incidencias_pct, uso_full_flex_pct, cancelaciones_stock_pct, score_logistica, skus_sin_stock_pct, dias_stock, lead_time_reposicion, sistema_reposicion, score_stock, created_by, source, created_at"
    )
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DiagnosticRow;
}

export async function getClientScoreHistoryRows(clientId: string, limit = 18): Promise<ScoreHistoryRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("score_history")
    .select("id, client_id, date, score_global, score_salud, score_pubs, score_ads, score_logistica, score_stock")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as ScoreHistoryRow[];
}
