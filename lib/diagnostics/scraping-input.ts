import type { DiagnosticInput } from "@/lib/types";

type ScrapingResult = {
  tipo?: string;
  metrics?: Record<string, unknown>;
};

const numberOrDefault = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function buildDiagnosticInputFromScraping(results: ScrapingResult[]): DiagnosticInput {
  const metrics = results.reduce<Record<string, unknown>>((acc, result) => {
    Object.assign(acc, result.metrics ?? {});
    return acc;
  }, {});

  return {
    salud: {
      reclamos: numberOrDefault(metrics.reclamos),
      mediaciones: numberOrDefault(metrics.mediaciones),
      cancelaciones_vendedor: numberOrDefault(metrics.cancelaciones_vendedor),
      envios_a_tiempo: numberOrDefault(metrics.envios_a_tiempo)
    },
    publicaciones: {
      pubs_activas_pct: numberOrDefault(metrics.pubs_activas_pct),
      pubs_optimizadas_pct: numberOrDefault(metrics.pubs_optimizadas_pct),
      ctr: numberOrDefault(metrics.ctr)
    },
    ads: {
      margen_pre_ads: numberOrDefault(metrics.margen_pre_ads),
      gasto_ads: numberOrDefault(metrics.gasto_ads),
      ventas_ads: numberOrDefault(metrics.ventas_ads),
      ventas_totales: numberOrDefault(metrics.ventas_totales),
      acos: numberOrDefault(metrics.acos),
      roas: numberOrDefault(metrics.roas),
      tacos: numberOrDefault(metrics.tacos)
    },
    logistica: {
      incidencias_pct: numberOrDefault(metrics.incidencias_pct),
      uso_full_flex_pct: numberOrDefault(metrics.uso_full_flex_pct),
      cancelaciones_stock_pct: numberOrDefault(metrics.cancelaciones_stock_pct)
    },
    stock: {
      skus_sin_stock_pct: numberOrDefault(metrics.skus_sin_stock_pct),
      dias_stock: numberOrDefault(metrics.dias_stock),
      lead_time_reposicion: numberOrDefault(metrics.lead_time_reposicion),
      sistema_reposicion: numberOrDefault(metrics.sistema_reposicion)
    }
  };
}

export function hasRequiredScrapingBlocks(results: ScrapingResult[]) {
  const types = new Set(results.map((result) => result.tipo));
  return ["salud", "publicaciones", "ads", "stock"].every((type) => types.has(type));
}
