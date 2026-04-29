import { revalidatePath } from "next/cache";
import { upsertCatalogEnrichmentBatch, type CatalogEnrichmentInput } from "@/lib/data-v2/catalog-enrichment";
import { createIngestionLog, updateIngestionLog } from "@/lib/data-v2/file-ingestion-log";
import { parseFichaTecnicaRows } from "@/lib/ingestion/parsers/parse-ficha-tecnica";
import type { FichaTecnicaRow, IngestionResult } from "@/lib/ingestion/types";

function getCell(row: Record<string, unknown>, f: string) {
  return row[f];
}

export async function ingestFichaTecnica(
  mlAccountId: string,
  companyId: string,
  rawRows: Record<string, unknown>[],
  filename: string,
  storagePath: string
): Promise<IngestionResult> {
  const p = parseFichaTecnicaRows(rawRows, getCell);
  if (p.errors.length > 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Rechazado: hay errores en la planilla"] };
  }
  if (p.valid.length === 0) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: ["Ninguna fila valida"] };
  }
  const log = await createIngestionLog({
    ml_account_id: mlAccountId,
    company_id: companyId,
    template_type: "ficha_tecnica",
    filename,
    storage_path: storagePath,
    rows_total: rawRows.length,
    rows_valid: p.valid.length,
    rows_error: 0,
    status: "processing"
  });
  if (!log.success) {
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [log.error] };
  }
  const logId = log.data.id;
  const batch: CatalogEnrichmentInput = p.valid.map((r: FichaTecnicaRow) => ({
    ml_account_id: mlAccountId,
    sku: r.sku,
    titulo: r.titulo,
    descripcion: r.descripcion,
    atributos: r.atributos,
    source_file: storagePath
  }));
  const u = await upsertCatalogEnrichmentBatch(batch);
  if (!u.success) {
    await updateIngestionLog(logId, { status: "error", error_summary: { m: u.error }, processed_at: new Date().toISOString() });
    return { success: false, rows_processed: 0, metrics_updated: {}, alerts_generated: 0, errors: [u.error] };
  }
  await updateIngestionLog(logId, {
    status: "success",
    rows_valid: p.valid.length,
    rows_error: 0,
    error_summary: null,
    metrics_updated: { filas: p.valid.length },
    alerts_generated: 0,
    processed_at: new Date().toISOString()
  });
  revalidatePath(`/internal/clients/${companyId}/files`);
  return { success: true, rows_processed: p.valid.length, metrics_updated: { filas: p.valid.length }, alerts_generated: 0, errors: [], log_id: logId };
}
