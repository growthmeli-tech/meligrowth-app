import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type Row = Database["public"]["Tables"]["catalog_enrichment"]["Row"];
type Insert = Database["public"]["Tables"]["catalog_enrichment"]["Insert"];

export type CatalogEnrichmentInput = {
  ml_account_id: string;
  sku: string;
  titulo: string;
  descripcion: string | null;
  atributos: Json;
  source_file: string;
}[];

export async function upsertCatalogEnrichmentBatch(rows: CatalogEnrichmentInput): Promise<ActionResult<number>> {
  if (rows.length === 0) return { success: true, data: 0 };
  const supabase = await createServerSupabaseClient();
  const payload: Insert[] = rows.map((r) => ({
    ml_account_id: r.ml_account_id,
    sku: r.sku,
    titulo: r.titulo,
    descripcion: r.descripcion,
    atributos: r.atributos,
    source_file: r.source_file
  }));
  const { data, error } = await supabase
    .from("catalog_enrichment")
    .upsert(payload, { onConflict: "ml_account_id,sku" })
    .select("id");
  if (error) {
    logServerError("catalog-enrichment.upsert", error, { n: rows.length });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo guardar catalogo", code: error.code };
  }
  return { success: true, data: (data?.length ?? 0) };
}

export async function listCatalogEnrichment(mlAccountId: string): Promise<ActionResult<Row[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("catalog_enrichment")
    .select("*")
    .eq("ml_account_id", mlAccountId)
    .order("updated_at", { ascending: false });

  if (error) {
    logServerError("catalog-enrichment.list", error, { mlAccountId });
    return { success: false, error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar catalog_enrichment", code: error.code };
  }

  return { success: true, data: (data ?? []) as Row[] };
}
