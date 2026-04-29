/**
 * Señales operativas cruzadas (Salud, Publicaciones, Ads, Logística, Stock).
 * Reglas explicables sin IA — solo cruces de métricas ya disponibles en el diagnóstico.
 */
import type { AdsAnalysis, Recommendation, RecommendationAudience } from "@/lib/recommendations/types";

/** Subconjunto mínimo del diagnóstico para cruces (evita dependencia circular con engine). */
export type OperationalDiagnosticSlice = {
  id: string;
  score_stock: number | null;
  score_publicaciones: number | null;
  pubs_activas_pct: number | null;
  pubs_optimizadas_pct: number | null;
  ctr: number | null;
  skus_sin_stock_pct: number | null;
  dias_stock: number | null;
  margen_pre_ads: number | null;
  gasto_ads: number | null;
  ventas_totales: number | null;
};

export type OperationalSignalsContext = {
  diagnostic: OperationalDiagnosticSlice;
  adsAnalysis: AdsAnalysis | null;
  meaningfulAds: boolean;
  data_sources?: Record<string, string>;
};

function audienceOperator(): RecommendationAudience {
  return "operator";
}

function audienceInternal(): RecommendationAudience {
  return "internal";
}

/** Riesgo de quiebre operativo: stock bajo o cobertura débil antes de escalar ads */
function stockRiskBeforeScale(d: OperationalDiagnosticSlice): boolean {
  const skus = typeof d.skus_sin_stock_pct === "number" ? d.skus_sin_stock_pct : null;
  const dias = typeof d.dias_stock === "number" ? d.dias_stock : null;
  if (skus !== null && skus > 8) return true;
  if (dias !== null && dias > 0 && dias < 7) return true;
  return typeof d.score_stock === "number" && d.score_stock < 58;
}

/** Publicaciones inactivas pero sin señal fuerte de ruptura de stock (proxy pausas recuperables) */
function pausedListingsWithLikelyStock(d: OperationalDiagnosticSlice): boolean {
  const pubs = typeof d.pubs_activas_pct === "number" ? d.pubs_activas_pct : null;
  const skus = typeof d.skus_sin_stock_pct === "number" ? d.skus_sin_stock_pct : null;
  if (pubs === null || pubs >= 38) return false;
  if (skus !== null && skus > 18) return false;
  return pubs < 35 && (skus === null || skus < 12);
}

/** Tráfico decente en parte del catálogo pero cobertura activa baja */
function trafficMismatchCatalog(d: OperationalDiagnosticSlice): boolean {
  const ctr = typeof d.ctr === "number" ? d.ctr : null;
  const pubs = typeof d.pubs_activas_pct === "number" ? d.pubs_activas_pct : null;
  if (ctr === null || pubs === null) return false;
  return ctr >= 1.2 && pubs < 55;
}

/** Alta CTR pero optimización de fichas débil — conversión suele quedar en tasa / ficha */
function highCtrLowOptimization(d: OperationalDiagnosticSlice): boolean {
  const ctr = typeof d.ctr === "number" ? d.ctr : null;
  const opt = typeof d.pubs_optimizadas_pct === "number" ? d.pubs_optimizadas_pct : null;
  if (ctr === null || opt === null) return false;
  return ctr >= 2 && opt < 45;
}

/** Oportunidad de activar ads: poca inversión relativa, cuenta sólida en catálogo y stock */
function adsCandidateOrganicStrong(d: OperationalDiagnosticSlice): boolean {
  const margen = typeof d.margen_pre_ads === "number" ? d.margen_pre_ads : null;
  const gasto = typeof d.gasto_ads === "number" ? d.gasto_ads : null;
  const ventasT = typeof d.ventas_totales === "number" ? d.ventas_totales : null;
  const skus = typeof d.skus_sin_stock_pct === "number" ? d.skus_sin_stock_pct : null;
  if (margen === null || margen < 18) return false;
  if (ventasT === null || ventasT <= 0 || gasto === null) return false;
  if (gasto > ventasT * 0.06) return false;
  if (skus !== null && skus > 6) return false;
  return typeof d.score_publicaciones === "number" && d.score_publicaciones >= 68;
}

function integrationGapAds(dataSources: Record<string, string> | undefined, meaningfulAds: boolean): boolean {
  if (meaningfulAds) return false;
  const src = dataSources?.ads;
  return src === "unavailable";
}

export function buildOperationalRecommendations(ctx: OperationalSignalsContext): Recommendation[] {
  const { diagnostic: d, adsAnalysis, meaningfulAds, data_sources } = ctx;
  const idBase = d.id;
  const out: Recommendation[] = [];

  if (
    adsAnalysis?.estado_salud === "escalable" &&
    meaningfulAds &&
    stockRiskBeforeScale(d)
  ) {
    out.push({
      id: `${idBase}-op-no-escalar-ads-stock`,
      categoria: "ads",
      prioridad: "alta",
      titulo: "No escalar ads: riesgo de stock / quiebre",
      descripcion:
        "El diagnóstico sugiere escalado en Ads, pero stock o cobertura no sostienen más demanda. Priorizar reposición y cobertura antes de subir inversión.",
      accion_concreta:
        "Congelar aumento de presupuesto; coordinar reposición de SKUs críticos y revisar días de cobertura; reevaluar ads cuando score stock supere 60 y SKUs sin stock <8%.",
      metrica_afectada: "cross_ads_stock",
      impacto_estimado: "Alto — evita deterioro de conversión y reputación por stock",
      benchmark_objetivo: "Stock estable antes de incrementar TACOS o presupuesto",
      audiencia: audienceOperator(),
      bloque: "03 Ads + 05 Stock"
    });
  }

  if (pausedListingsWithLikelyStock(d)) {
    out.push({
      id: `${idBase}-op-pausas-con-stock`,
      categoria: "publicaciones",
      prioridad: "alta",
      titulo: "Publicaciones pausadas con catálogo favorable",
      descripcion:
        "% activo bajo pero sin señal fuerte de catálogo roto por stock. Revisar pausas operativas (precio, calidad, errores) más que desabastecimiento.",
      accion_concreta:
        "Listar pausadas con stock disponible o en tránsito; reactivar priorizando top ventas; validar mínimos y competencia por SKU.",
      metrica_afectada: "cross_pubs_stock",
      impacto_estimado: "Alto — recupera demanda sin nueva inversión en ads",
      benchmark_objetivo: "Publicaciones activas acordes al inventario real",
      audiencia: audienceOperator(),
      bloque: "02 Publicaciones + 05 Stock"
    });
  }

  if (trafficMismatchCatalog(d)) {
    out.push({
      id: `${idBase}-op-trafico-vs-catalogo`,
      categoria: "publicaciones",
      prioridad: "media",
      titulo: "Tráfico en parte del catálogo; cobertura activa baja",
      descripcion:
        "CTR no es globalmente crítico pero el % de publicaciones activas es bajo: se concentra demanda en pocas fichas y se pierde conversión en el resto.",
      accion_concreta:
        "Activar y homogeneizar fichas de segundo nivel con demanda; revisar pausas masivas y priorizar SKUs con impresiones históricas.",
      metrica_afectada: "cross_ctr_pubs",
      impacto_estimado: "Medio — mejora conversión total sin subir solo CTR puntual",
      benchmark_objetivo: "Alinear % activas con intención de compra del catálogo",
      audiencia: audienceOperator(),
      bloque: "02 Publicaciones"
    });
  }

  if (highCtrLowOptimization(d)) {
    out.push({
      id: `${idBase}-op-ctr-vs-ficha`,
      categoria: "publicaciones",
      prioridad: "media",
      titulo: "Alto CTR, fichas aún no optimizadas",
      descripcion:
        "Hay captación de clicks pero optimización de catálogo por debajo del objetivo: suele indicar freno en conversión (ficha, precio, envío) más que en visibilidad.",
      accion_concreta:
        "Priorizar optimización de título, fotos y atributos en publicaciones con alto CTR y baja conversión relativa.",
      metrica_afectada: "cross_ctr_optimizacion",
      impacto_estimado: "Medio — mejora conversión sin aumentar tráfico pagado",
      benchmark_objetivo: "% optimizadas alineado a CTR alto",
      audiencia: audienceOperator(),
      bloque: "02 Publicaciones"
    });
  }

  if (adsCandidateOrganicStrong(d)) {
    out.push({
      id: `${idBase}-op-candidato-ads`,
      categoria: "ads",
      prioridad: "media",
      titulo: "Evaluar Product Ads en SKUs con margen y stock",
      descripcion:
        "Inversión publicitaria baja respecto a ventas totales, margen declarado adecuado y stock/catalogo razonables: candidato a prueba controlada de ads en top SKUs.",
      accion_concreta:
        "Definir 5–10 SKUs ganadores; validar margen y stock; lanzar campaña acotada con tope de gasto y revisión semanal de ROAS/TACOS.",
      metrica_afectada: "cross_ads_opportunity",
      impacto_estimado: "Medio — crecimiento incremental con techo de riesgo",
      benchmark_objetivo: "ROAS sobre break-even y TACOS acotado al margen",
      audiencia: audienceOperator(),
      bloque: "03 Ads"
    });
  }

  if (integrationGapAds(data_sources, meaningfulAds)) {
    out.push({
      id: `${idBase}-op-integracion-ads`,
      categoria: "ads",
      prioridad: "media",
      titulo: "Falta dato de Ads por integración",
      descripcion:
        "No hay fuente confiable de Ads (API/carga). No es lo mismo que ‘no invertir’: sin métrica no se puede priorizar inversión ni TACOS.",
      accion_concreta:
        "Completar margen pre-ads y movimientos en planilla o reconectar API de Mercado Ads.",
      metrica_afectada: "integration_ads",
      impacto_estimado: "Medio — habilita decisiones de inversión",
      benchmark_objetivo: "Gasto y ventas ads + ventas totales del período",
      audiencia: audienceInternal(),
      bloque: "03 Ads"
    });
  }

  return out;
}
