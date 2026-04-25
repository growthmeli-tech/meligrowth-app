import { getValidAccessToken } from "@/lib/ml/auth";
import { getAdvertiserId, getAdsMetrics, mapAdsToDiagnostic } from "@/lib/ml/endpoints/ads";
import { getListingsOptimizationRate, getListingsStats, mapListingsToDiagnostic } from "@/lib/ml/endpoints/listings";
import { getLogisticsMetrics } from "@/lib/ml/endpoints/logistics";
import { getSellerReputation, mapReputationToDiagnostic } from "@/lib/ml/endpoints/reputation";
import { getStockMetrics } from "@/lib/ml/endpoints/stock";
import { mapScraperMetricsToPrefill } from "@/lib/ml/mappers/to-diagnostic";
import type { MlDataSource, MlDiagnosticPrefill } from "@/lib/ml/mappers/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PipelineResult = { success: true; data: MlDiagnosticPrefill } | { success: false; error: string };
type ScraperTipo = "salud" | "publicaciones" | "ads" | "stock";

function logPipelineError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[ml-pipeline:${scope}]`, { error, ...(context ?? {}) });
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

async function triggerScrapeJob(clientId: string, tipo: ScraperTipo) {
  const supabase = await createServerSupabaseClient();
  const { data: job, error: insertError } = await supabase
    .from("scraping_jobs")
    .insert({
      client_id: clientId,
      tipo,
      estado: "pending"
    })
    .select("id")
    .single();

  if (insertError || !job) {
    throw new Error(insertError?.message ?? `Could not create scraping job for ${tipo}`);
  }

  const runResult = await callScraperJob(job.id);
  return runResult?.result?.metrics ?? null;
}

export async function fetchMLDiagnosticData(clientId: string, sellerId: string): Promise<PipelineResult> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(clientId);
  } catch (error) {
    logPipelineError("auth", error, { clientId, sellerId });
    return {
      success: false,
      error: "No hay sesión válida con Mercado Libre. Reautorizá la cuenta desde Configuración."
    };
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

  const scraperCache = new Map<ScraperTipo, Record<string, unknown> | null>();
  const readScraper = async (tipo: ScraperTipo) => {
    if (scraperCache.has(tipo)) return scraperCache.get(tipo) ?? null;
    try {
      const metrics = await triggerScrapeJob(clientId, tipo);
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
  } catch (error) {
    logPipelineError("salud_api", error, { sellerId });
    const scraperMetrics = await readScraper("salud");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.salud = "scraper";
    }
  }

  try {
    const [stats, optimizationRate] = await Promise.all([
      getListingsStats(sellerId, accessToken),
      getListingsOptimizationRate(sellerId, accessToken)
    ]);
    Object.assign(prefill, mapListingsToDiagnostic(stats, optimizationRate));
    dataSources.publicaciones = "api";
  } catch (error) {
    logPipelineError("publicaciones_api", error, { sellerId });
    const scraperMetrics = await readScraper("publicaciones");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.publicaciones = "scraper";
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
    } else {
      Object.assign(prefill, mapAdsToDiagnostic(null));
    }
  } catch (error) {
    logPipelineError("ads_api", error, { sellerId });
    const scraperMetrics = await readScraper("ads");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.ads = "scraper";
    }
  }

  try {
    const logistics = await getLogisticsMetrics(sellerId, accessToken);
    Object.assign(prefill, logistics);
    dataSources.logistica = "api";
  } catch (error) {
    logPipelineError("logistica_api", error, { sellerId });
    const scraperMetrics = await readScraper("stock");
    if (scraperMetrics) {
      const mapped = mapScraperMetricsToPrefill(scraperMetrics);
      Object.assign(prefill, {
        incidencias_pct: mapped.incidencias_pct,
        uso_full_flex_pct: mapped.uso_full_flex_pct,
        cancelaciones_stock_pct: mapped.cancelaciones_stock_pct
      });
      dataSources.logistica = "scraper";
    }
  }

  try {
    const stock = await getStockMetrics(sellerId, accessToken);
    Object.assign(prefill, stock);
    dataSources.stock = "api";
  } catch (error) {
    logPipelineError("stock_api", error, { sellerId });
    const scraperMetrics = await readScraper("stock");
    if (scraperMetrics) {
      Object.assign(prefill, mapScraperMetricsToPrefill(scraperMetrics));
      dataSources.stock = "scraper";
    }
  }

  prefill.ctr ??= null;
  prefill.dias_stock ??= null;
  prefill.lead_time_reposicion ??= null;
  prefill.data_sources = dataSources;

  return {
    success: true,
    data: prefill as MlDiagnosticPrefill
  };
}
