import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import type { Estado } from "@/lib/types";

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

export async function getDiagnosticHistory(
  clientId: string,
  limit = 18
): Promise<ActionResult<Array<{ date: string; scoreGlobal: number; salud: number; publicaciones: number; ads: number; logistica: number; stock: number }>>> {
  const rows = await getClientScoreHistoryRows(clientId, limit);
  return {
    success: true,
    data: rows
      .map((row) => ({
        date: row.date,
        scoreGlobal: Number(row.score_global ?? 0),
        salud: Number(row.score_salud ?? 0),
        publicaciones: Number(row.score_pubs ?? 0),
        ads: Number(row.score_ads ?? 0),
        logistica: Number(row.score_logistica ?? 0),
        stock: Number(row.score_stock ?? 0)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  };
}

export async function getDiagnosticWithDelta(
  clientId: string
): Promise<ActionResult<{ current: DiagnosticRow; delta: number | null }>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2);

  if (error || !data || data.length === 0) {
    return { success: false, error: "No hay diagnósticos para este cliente" };
  }

  const [current, previous] = data as DiagnosticRow[];
  const delta = previous ? Number(current.score_global ?? 0) - Number(previous.score_global ?? 0) : null;
  return {
    success: true,
    data: {
      current,
      delta
    }
  };
}

export function getEstadoSimpleParaCliente(estado: Estado | string) {
  switch (estado) {
    case "platinum":
      return "Tu cuenta está excelente y creciendo de forma sostenida.";
    case "solido":
      return "Tu cuenta está sólida y con buen rendimiento.";
    case "desarrollo":
      return "Tu cuenta está en desarrollo y con oportunidades claras de mejora.";
    case "riesgo":
      return "Tu cuenta necesita atención prioritaria para recuperar performance.";
    case "critico":
      return "Tu cuenta está en estado crítico y estamos trabajando en acciones urgentes.";
    default:
      return "Estamos monitoreando tu cuenta y preparando próximos pasos.";
  }
}
