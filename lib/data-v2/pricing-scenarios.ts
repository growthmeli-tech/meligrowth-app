import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type Insert = Database["public"]["Tables"]["pricing_scenarios"]["Insert"];
type Row = Database["public"]["Tables"]["pricing_scenarios"]["Row"];

export function calcScenarioRow(input: {
  current_revenue: number;
  projected_revenue: number;
  gross_margin_pct: number; // 0-1
  delivery_cost: number;
  months: number;
}): { net_margin_pct: number; monthly_profit: number; total_projected_profit: number } {
  const { projected_revenue, gross_margin_pct, delivery_cost, months } = input;
  const delRatio = projected_revenue > 0 ? delivery_cost / projected_revenue : 0;
  const net = gross_margin_pct - delRatio;
  const monthly_profit = projected_revenue * net;
  const total_projected_profit = monthly_profit * months;
  return {
    net_margin_pct: net,
    monthly_profit,
    total_projected_profit
  };
}

export async function insertPricingScenariosBatch(rows: Insert[]): Promise<ActionResult<Row[]>> {
  if (rows.length === 0) return { success: true, data: [] };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("pricing_scenarios").insert(rows).select("*");
  if (error) {
    logServerError("pricing-scenarios.insert", error, { n: rows.length });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron guardar escenarios", code: error.code };
  }
  return { success: true, data: (data ?? []) as Row[] };
}
