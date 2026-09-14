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

/** Spreadsheet ingest stores `companyId/timestamp-filename`. Shells/inline use constants without `/`. */
export const PRICING_SKU_INGEST_SOURCE_PATTERN = "%/%";

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

export async function deleteIngestedPricingSkusForAccount(mlAccountId: string): Promise<ActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("pricing_skus")
    .delete()
    .eq("ml_account_id", mlAccountId)
    .like("source_file", PRICING_SKU_INGEST_SOURCE_PATTERN);
  if (error) {
    logServerError("pricing-skus.deleteIngestedForAccount", error, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo borrar filas de pricing",
      code: error.code
    };
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
  // Empty payload is rollback of *this* upload only (unique timestamped path).
  if (rows.length === 0) {
    const del = await deletePricingSkusBySource(mlAccountId, sourceFile);
    if (!del.success) return del;
    return { success: true, data: [] };
  }

  const supabase = await createServerSupabaseClient();
  const { data: previous, error: loadErr } = await supabase
    .from("pricing_skus")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .like("source_file", PRICING_SKU_INGEST_SOURCE_PATTERN);

  if (loadErr) {
    logServerError("pricing-skus.bulkReplace.loadPrevious", loadErr, { mlAccountId });
    return {
      success: false,
      error: isPostgresError(loadErr) ? formatSupabaseError(loadErr) : "No se pudieron leer filas de pricing",
      code: loadErr.code
    };
  }

  // Each upload uses a unique storage path, so deleting only `sourceFile` is a
  // no-op and the insert hits idx_pricing_skus_account_sku_producto.
  const del = await deleteIngestedPricingSkusForAccount(mlAccountId);
  if (!del.success) return del;

  const withFile = rows.map((r) => ({ ...r, source_file: sourceFile, ml_account_id: mlAccountId } as Insert));
  const inserted = await insertPricingSkusBatch(withFile);
  if (!inserted.success && previous && previous.length > 0) {
    const restore = (previous as Row[]).map(({ created_at: _c, updated_at: _u, ...rest }) => {
      void _c;
      void _u;
      return rest as Insert;
    });
    await insertPricingSkusBatch(restore);
  }
  return inserted;
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
