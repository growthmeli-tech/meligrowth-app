import { MlApiError, MlAuthError, MlRateLimitError } from "@/lib/ml/client";
import { getValidAccessToken } from "@/lib/ml/auth";
import { getAdvertiserId, getAdsMetrics, mapAdsToDiagnostic } from "@/lib/ml/endpoints/ads";
import { getListingsOptimizationRate, getListingsStats, getMarketplaceListingsCap, mapListingsToDiagnostic } from "@/lib/ml/endpoints/listings";
import { getLogisticsMetrics } from "@/lib/ml/endpoints/logistics";
import { getSellerReputation, mapReputationToDiagnostic } from "@/lib/ml/endpoints/reputation";
import { getStockMetrics } from "@/lib/ml/endpoints/stock";
import { mapScraperMetricsToPrefill } from "@/lib/ml/mappers/to-diagnostic";
import type { MlDataSource, MlDiagnosticPrefill } from "@/lib/ml/mappers/types";
import { createIngestionRunPipeline, finishIngestionRunPipeline, type IngestionBlockEntry } from "@/lib/data-v2/ingestion-runs";
import { createMetricSnapshot } from "@/lib/data-v2/metric-snapshots";
import { runRecommendationsPipelineV2 } from "@/lib/recommendations/pipeline-v2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PipelineResult = { success: true; data: MlDiagnosticPrefill } | { success: false; error: string };
type ScraperTipo = "salud" | "publicaciones" | "ads" | "stock";

const BLOCK_KEYS = ["salud", "publicaciones", "ads", "logistica", "stock"] as const;
type BlockKey = (typeof BLOCK_KEYS)[number];

function logPipelineError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[ml-pipeline:${scope}]`, { error, ...(context ?? {}) });
}

/**
 * Logs ML fetch failures with HTTP status and response body when available.
 * Use this for API block failures so Vercel/server logs show the exact ML error (not only Error{}).
 */
function logPipelineMlApiFailure(scope: string, error: unknown, context: Record<string, unknown>) {
  if (error instanceof MlApiError) {
    console.error(`[ml-pipeline:${scope}]`, {
      ...context,
      mlError: "MlApiError",
      httpStatus: error.statusCode,
      detail: error.message
    });
    return;
  }
  if (error instanceof MlAuthError) {
    console.error(`[ml-pipeline:${scope}]`, {
      ...context,
      mlError: "MlAuthError",
      httpStatus: error.statusCode,
      detail: error.message,
      responseBody: error.responseBody
    });
    return;
  }
  if (error instanceof MlRateLimitError) {
    console.error(`[ml-pipeline:${scope}]`, {
      ...context,
      mlError: "MlRateLimitError",
      endpoint: error.endpoint,
      retryAfter: error.retryAfter,
      attempt: error.attempt
    });
    return;
  }
  logPipelineError(scope, error, context);
}

function classifyFetchError(error: unknown): { kind: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("401") || lower.includes("403") || message.includes("MlAuthError")) {
    return { kind: "auth_forbidden", message };
  }
  if (error instanceof MlRateLimitError || lower.includes("mllratelimiterror")) {
    return { kind: "rate_limit", message };
  }
  if (lower.includes("404")) {
    return { kind: "not_found", message };
  }
  return { kind: "api_error", message };
}

function blockEntry(
  source: MlDataSource,
  ok: boolean,
  error?: unknown,
  extra?: Partial<IngestionBlockEntry>
): IngestionBlockEntry {
  if (!error) {
    return { source, ok, ...extra };
  }
  const { kind, message } = classifyFetchError(error);
  return {
    source,
    ok,
    error_kind: kind,
    message: message.slice(0, 500),
    ...extra
  };
}

async function callScraperJob(jobId: string) {
  const scraperUrl = process.env.SCRAPER_SERVICE_URL?.replace(/\/$/, "");
  const scraperSecret = process.env.SCRAPER_SERVICE_SECRET;
  if (!scraperUrl || !scraperSecret) return null;

  const response = await fetch(`${scraperUrl}/jobs/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scraper-secret": scraperSecret
    },
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Scraper job failed (${response.status})`);
  }

  return response.json() as Promise<{ result?: { metrics?: Record<string, unknown> } }>;
}

type ScrapeJobContext =
  | { mode: "legacy"; clientId: string }
  | { mode: "v2"; mlAccountId: string };

async function triggerScrapeJob(tipo: ScraperTipo, ctx: ScrapeJobContext) {
  const supabase = await createServerSupabaseClient();
  const insertPayload =
    ctx.mode === "v2"
      ? { ml_account_id: ctx.mlAccountId, tipo, estado: "pending" as const }
      : { client_id: ctx.clientId, tipo, estado: "pending" as const };

  const { data: job, error: insertError } = await supabase.from("scraping_jobs").insert(insertPayload).select("id").single();

  if (insertError || !job) {
    throw new Error(insertError?.message ?? `Could not create scraping job for ${tipo}`);
  }

  const runResult = await callScraperJob(job.id);
  return runResult?.result?.metrics ?? null;
}

export async function fetchMLDiagnosticData(
  clientId: string,
  sellerId: string,
  options?: { mlAccountId?: string }
): Promise<PipelineResult> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(clientId, options?.mlAccountId);
  } catch (error) {
    logPipelineError("auth", error, { clientId, sellerId });
    return {
      success: false,
      error: "No hay sesión válida con Mercado Libre. Reautorizá la cuenta desde Configuración."
    };
  }

  const scrapeCtx: ScrapeJobContext = options?.mlAccountId
    ? { mode: "v2", mlAccountId: options.mlAccountId }
    : { mode: "legacy", clientId };

  let ingestionRunId: string | null = null;
  if (options?.mlAccountId) {
    const started = await createIngestionRunPipeline({
      ml_account_id: options.mlAccountId,
      source: "api",
      blocks_fetched: { _meta: { pipeline: "ml_fetch", version: 1 } }
    });
    if (started.success) {
      ingestionRunId = started.data.id;
    } else {
      logPipelineError("ingestion_run_start", started.error, { clientId, mlAccountId: options.mlAccountId });
    }
  }

  const prefill: Partial<MlDiagnosticPrefill> = {
    seller_id: sellerId,
    synced_at: new Date().toISOString()
  };

  const dataSources: Record<string, MlDataSource> = {
    salud: "unavailable",
    publicaciones: "unavailable",
    ads: "unavailable",
    logistica: "unavailable",
    stock: "unavailable"
  };

  const blocksFetched: Record<string, IngestionBlockEntry | Record<string, unknown>> = {
    _meta: { pipeline: "ml_fetch", version: 1, seller_id: sellerId }
  };

  const scraperCache = new Map<ScraperTipo, Record<string, unknown> | null>();
  const readScraper = async (tipo: ScraperTipo) => {
    if (scraperCache.has(tipo)) return scraperCache.get(tipo) ?? null;
    try {
      const metrics = await triggerScrapeJob(tipo, scrapeCtx);
      scraperCache.set(tipo, metrics);
      return metrics;
    } catch (error) {
      logPipelineError(`scraper_${tipo}`, error, { clientId, sellerId });
      scraperCache.set(tipo, null);
      return null;
    }
  };

  try {
    const reputation = await getSellerReputation(sellerId, accessToken);
    Object.assign(prefill, mapReputationToDiagnostic(reputation));
    dataSources.salud = "api";
    blocksFetched.salud = blockEntry("api", true);
  } catch (error) {
    logPipelineMlApiFailure("salud_api", error, { sellerId });
    blocksFetched.salud = blockEntry("api", false, error);
    const scraperMetrics = await readScraper("salud");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.salud = "scraper";
      blocksFetched.salud = { ...blockEntry("scraper", true), note: "api_failed_scraper_ok" };
    } else {
      blocksFetched.salud = { ...blockEntry("unavailable", false, error), scraper: "failed_or_skipped" };
    }
  }

  try {
    const [stats, optimizationRate] = await Promise.all([
      getListingsStats(sellerId, accessToken),
      getListingsOptimizationRate(sellerId, accessToken)
    ]);
    Object.assign(prefill, mapListingsToDiagnostic(stats, optimizationRate));
    try {
      const cap = await getMarketplaceListingsCap(sellerId, accessToken);
      if (cap.quota !== null) prefill.listings_quota = cap.quota;
      if (cap.total_items !== null) prefill.listings_total_items = cap.total_items;
    } catch (capError) {
      logPipelineMlApiFailure("listings_cap_api", capError, { sellerId });
    }
    dataSources.publicaciones = "api";
    blocksFetched.publicaciones = blockEntry("api", true);
  } catch (error) {
    logPipelineMlApiFailure("publicaciones_api", error, { sellerId });
    blocksFetched.publicaciones = blockEntry("api", false, error);
    const scraperMetrics = await readScraper("publicaciones");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.publicaciones = "scraper";
      blocksFetched.publicaciones = { ...blockEntry("scraper", true), note: "api_failed_scraper_ok" };
    } else {
      blocksFetched.publicaciones = { ...blockEntry("unavailable", false, error), scraper: "failed_or_skipped" };
    }
  }

  try {
    const advertiserId = await getAdvertiserId(accessToken);
    if (advertiserId) {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);

      const adsMetrics = await getAdsMetrics(
        advertiserId,
        accessToken,
        dateFrom.toISOString().slice(0, 10),
        dateTo.toISOString().slice(0, 10)
      );
      Object.assign(prefill, mapAdsToDiagnostic(adsMetrics));
      dataSources.ads = "api";
      blocksFetched.ads = blockEntry("api", true);
    } else {
      Object.assign(prefill, mapAdsToDiagnostic(null));
      dataSources.ads = "api";
      blocksFetched.ads = {
        source: "api",
        ok: true,
        error_kind: "no_advertiser",
        message: "No PADS advertiser — sin campañas product ads o permisos de advertising"
      };
    }
  } catch (error) {
    logPipelineMlApiFailure("ads_api", error, { sellerId });
    blocksFetched.ads = blockEntry("api", false, error);
    const scraperMetrics = await readScraper("ads");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.ads = "scraper";
      blocksFetched.ads = { ...blockEntry("scraper", true), note: "api_failed_scraper_ok" };
    } else {
      blocksFetched.ads = { ...blockEntry("unavailable", false, error), scraper: "failed_or_skipped" };
    }
  }

  try {
    const logistics = await getLogisticsMetrics(sellerId, accessToken);
    Object.assign(prefill, logistics);
    dataSources.logistica = "api";
    blocksFetched.logistica = blockEntry("api", true);
  } catch (error) {
    logPipelineMlApiFailure("logistica_api", error, { sellerId });
    blocksFetched.logistica = blockEntry("api", false, error);
    const scraperMetrics = await readScraper("stock");
    if (scraperMetrics) {
      const mapped = mapScraperMetricsToPrefill(scraperMetrics);
      Object.assign(prefill, {
        incidencias_pct: mapped.incidencias_pct,
        uso_full_flex_pct: mapped.uso_full_flex_pct,
        cancelaciones_stock_pct: mapped.cancelaciones_stock_pct
      });
      dataSources.logistica = "scraper";
      blocksFetched.logistica = { ...blockEntry("scraper", true), note: "api_failed_scraper_used_stock_job" };
    } else {
      blocksFetched.logistica = { ...blockEntry("unavailable", false, error), scraper: "failed_or_skipped" };
    }
  }

  try {
    const stock = await getStockMetrics(sellerId, accessToken);
    Object.assign(prefill, stock);
    dataSources.stock = "api";
    blocksFetched.stock = blockEntry("api", true);
  } catch (error) {
    logPipelineMlApiFailure("stock_api", error, { sellerId });
    blocksFetched.stock = blockEntry("api", false, error);
    const scraperMetrics = await readScraper("stock");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.stock = "scraper";
      blocksFetched.stock = { ...blockEntry("scraper", true), note: "api_failed_scraper_ok" };
    } else {
      blocksFetched.stock = { ...blockEntry("unavailable", false, error), scraper: "failed_or_skipped" };
    }
  }

  prefill.ctr ??= null;
  prefill.dias_stock ??= null;
  prefill.lead_time_reposicion ??= null;
  prefill.data_sources = dataSources;

  if (options?.mlAccountId) {
    try {
      const snapshotPayload = {
        ml_account_id: options.mlAccountId,
        snapshot_date: new Date().toISOString().slice(0, 10),
        source: inferSnapshotSource(dataSources),
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
        margen_pre_ads: null,
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
        sistema_reposicion: null,
        data_sources: dataSources
      };

      const snapshotResult = await createMetricSnapshot(snapshotPayload);
      if (!snapshotResult.success) {
        logPipelineError("v2_snapshot", snapshotResult.error, {
          clientId,
          sellerId,
          mlAccountId: options.mlAccountId
        });
        blocksFetched.v2_persist = {
          snapshot_ok: false,
          error: snapshotResult.error
        };
      } else {
        blocksFetched.v2_persist = { snapshot_ok: true, metric_snapshot_id: snapshotResult.data.id };
        const recommendationsResult = await runRecommendationsPipelineV2({
          ml_account_id: options.mlAccountId,
          metric_snapshot_id: snapshotResult.data.id
        });
        if (!recommendationsResult.success) {
          logPipelineError("v2_recommendations", recommendationsResult.error, {
            clientId,
            sellerId,
            mlAccountId: options.mlAccountId,
            metricSnapshotId: snapshotResult.data.id
          });
          blocksFetched.v2_persist = {
            ...blocksFetched.v2_persist,
            recommendations_ok: false,
            recommendations_error: recommendationsResult.error
          };
        } else {
          blocksFetched.v2_persist = {
            ...blocksFetched.v2_persist,
            recommendations_ok: true,
            alerts_persisted: recommendationsResult.data.persisted_alerts_count
          };
        }
      }
    } catch (error) {
      // Keep legacy pipeline alive while v2 is being rolled out.
      logPipelineError("v2_pipeline", error, { clientId, sellerId, mlAccountId: options.mlAccountId });
      blocksFetched.v2_persist = {
        snapshot_ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  if (ingestionRunId) {
    const unavailableBlocks = (["salud", "publicaciones", "ads", "logistica", "stock"] as const).filter(
      (k) => dataSources[k] === "unavailable"
    );
    const meta = (blocksFetched._meta && typeof blocksFetched._meta === "object" ? blocksFetched._meta : {}) as Record<
      string,
      unknown
    >;
    await finishIngestionRunPipeline(ingestionRunId, {
      status: "success",
      blocks_fetched: {
        ...blocksFetched,
        data_sources_summary: dataSources,
        _meta: {
          ...meta,
          ingestion_quality: unavailableBlocks.length ? "partial" : "full",
          unavailable_blocks: unavailableBlocks
        }
      },
      error_msg: null
    });
  }

  return {
    success: true,
    data: prefill as MlDiagnosticPrefill
  };
}

function inferSnapshotSource(dataSources: Record<string, MlDataSource>): "api" | "scraper" | "manual" | "csv" {
  const values = Object.values(dataSources);
  if (values.some((source) => source === "api")) return "api";
  if (values.some((source) => source === "scraper")) return "scraper";
  if (values.some((source) => source === "manual")) return "manual";
  return "manual";
}
