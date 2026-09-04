import type { Database } from "@/lib/supabase/database.types";
import type { MlDataSource, MlDiagnosticPrefill } from "@/lib/ml/mappers/types";

type MetricSnapshotInsert = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

/** Fields the ML fetch pipeline never produces; they come from Excel ingest or manual diagnostic. */
export type PreservedManualSnapshotFields = {
  margen_pre_ads: number | null;
  sistema_reposicion: number | null;
};

/**
 * ML sync upserts the same (ml_account_id, snapshot_date) row as Excel ingest.
 * The pipeline does not fetch pre-ads margin or replenishment-system coverage, so those
 * keys must not be forced to null — otherwise a sync after margenes_costos wipes scoring.
 */
export function preserveManualSnapshotFields(
  existing: Partial<PreservedManualSnapshotFields> | null | undefined
): PreservedManualSnapshotFields {
  const margen = existing?.margen_pre_ads;
  const sistema = existing?.sistema_reposicion;
  return {
    margen_pre_ads: margen !== null && margen !== undefined && Number.isFinite(Number(margen)) ? Number(margen) : null,
    sistema_reposicion:
      sistema !== null && sistema !== undefined && Number.isFinite(Number(sistema)) ? Number(sistema) : null
  };
}

export function buildMlPipelineSnapshotPayload(input: {
  mlAccountId: string;
  snapshotDate: string;
  source: MetricSnapshotInsert["source"];
  prefill: Partial<MlDiagnosticPrefill>;
  dataSources: Record<string, MlDataSource>;
  existing: Partial<PreservedManualSnapshotFields> | null | undefined;
}): MetricSnapshotInsert {
  const preserved = preserveManualSnapshotFields(input.existing);
  const prefill = input.prefill;
  return {
    ml_account_id: input.mlAccountId,
    snapshot_date: input.snapshotDate,
    source: input.source,
    reclamos: prefill.reclamos ?? null,
    mediaciones: prefill.mediaciones ?? null,
    cancelaciones_vendedor: prefill.cancelaciones_vendedor ?? null,
    envios_a_tiempo: prefill.envios_a_tiempo ?? null,
    nivel_vendedor: prefill.nivel_vendedor ?? null,
    ventas_completadas_60d: prefill.ventas_completadas_60d ?? null,
    periodo_reputacion: prefill.periodo_reputacion ?? null,
    reputacion_protegida: prefill.reputacion_protegida ?? null,
    reputacion_real_level: prefill.reputacion_real_level ?? null,
    reputacion_level_id: prefill.reputacion_level_id ?? null,
    listings_quota: prefill.listings_quota ?? null,
    listings_total_items: prefill.listings_total_items ?? null,
    pubs_activas_pct: prefill.pubs_activas_pct ?? null,
    pubs_optimizadas_pct: prefill.pubs_optimizadas_pct ?? null,
    ctr: prefill.ctr ?? null,
    margen_pre_ads: preserved.margen_pre_ads,
    gasto_ads: prefill.gasto_ads ?? null,
    ventas_ads: prefill.ventas_ads ?? null,
    ventas_totales: prefill.ventas_totales ?? null,
    acos: prefill.acos ?? null,
    roas: prefill.roas ?? null,
    tacos: prefill.tacos ?? null,
    incidencias_pct: prefill.incidencias_pct ?? null,
    uso_full_flex_pct: prefill.uso_full_flex_pct ?? null,
    cancelaciones_stock_pct: prefill.cancelaciones_stock_pct ?? null,
    skus_sin_stock_pct: prefill.skus_sin_stock_pct ?? null,
    dias_stock: prefill.dias_stock ?? null,
    lead_time_reposicion: prefill.lead_time_reposicion ?? null,
    sistema_reposicion: preserved.sistema_reposicion,
    data_sources: input.dataSources
  };
}
