import "server-only";

import { normalizePct } from "@/lib/pricing/calculator";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type Row = Database["public"]["Tables"]["pricing_skus"]["Row"];
type Insert = Database["public"]["Tables"]["pricing_skus"]["Insert"];

export type NormalizedPricingSkuRow = Row;

function normalizePricingSkuRow(row: Row): NormalizedPricingSkuRow {
  return {
    ...row,
    publicidad_pct: row.publicidad_pct === null || row.publicidad_pct === undefined ? null : normalizePct(Number(row.publicidad_pct)),
    margen_pct: row.margen_pct === null || row.margen_pct === undefined ? null : normalizePct(Number(row.margen_pct))
  };
}

export async function deletePricingSkusBySource(
  mlAccountId: string,
  sourceFile: string
): Promise<ActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("pricing_skus").delete().eq("ml_account_id", mlAccountId).eq("source_file", sourceFile);
  if (error) {
    logServerError("pricing-skus.deleteBySource", error, { mlAccountId, sourceFile });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo borrar filas de pricing", code: error.code };
  }
  return { success: true, data: undefined };
}

export async function insertPricingSkusBatch(rows: Insert[]): Promise<ActionResult<Row[]>> {
  if (rows.length === 0) return { success: true, data: [] };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("pricing_skus").insert(rows).select("*");
  if (error) {
    logServerError("pricing-skus.insertBatch", error, { count: rows.length });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudieron guardar filas de pricing", code: error.code };
  }
  return { success: true, data: (data ?? []) as Row[] };
}

export async function bulkReplacePricingSkusForFile(
  mlAccountId: string,
  sourceFile: string,
  rows: Insert[]
): Promise<ActionResult<Row[]>> {
  const del = await deletePricingSkusBySource(mlAccountId, sourceFile);
  if (!del.success) return del;
  if (rows.length === 0) return { success: true, data: [] };
  const withFile = rows.map((r) => ({ ...r, source_file: sourceFile, ml_account_id: mlAccountId } as Insert));
  return insertPricingSkusBatch(withFile);
}

export async function listPricingSkus(mlAccountId: string): Promise<ActionResult<NormalizedPricingSkuRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("pricing_skus")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .order("updated_at", { ascending: false });

  if (error) {
    logServerError("pricing-skus.list", error, { mlAccountId });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar pricing_skus", code: error.code };
  }

  const raw = (data ?? []) as Row[];
  return { success: true, data: raw.map(normalizePricingSkuRow) };
}
