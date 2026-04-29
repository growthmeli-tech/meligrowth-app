/**
 * MercadoLibre-native recommendation signals (API / snapshot context, not scoring benchmarks).
 */
import { isRealLevelWorseThanDisplayed } from "@/lib/ml/endpoints/reputation";
import type { Recommendation } from "@/lib/recommendations/types";

export type MlSnapshotSignalsInput = {
  diagnosticId: string;
  nivel_vendedor: string | null;
  ventas_completadas_60d: number | null;
  reputacion_real_level: string | null;
  reputacion_level_id: string | null;
  listings_quota: number | null;
  listings_total_items: number | null;
  uso_full_flex_pct: number | null;
  acos: number | null;
  margen_pre_ads: number | null;
  dias_stock: number | null;
  skus_sin_stock_pct: number | null;
  ventas_totales: number | null;
};

function fmt(n: number, digits = 0) {
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

export function buildMlNativeSignals(input: MlSnapshotSignalsInput): Recommendation[] {
  const id = input.diagnosticId;
  const out: Recommendation[] = [];

  // 2.1 — Protected seller: real_level exists and is worse than level_id
  if (isRealLevelWorseThanDisplayed(input.reputacion_real_level, input.reputacion_level_id)) {
    const real = (input.reputacion_real_level ?? "").trim() || "desconocido";
    out.push({
      id: `${id}-ml-signal-reputacion-protegida`,
      categoria: "salud",
      prioridad: "alta",
      titulo: "Tu reputación real está siendo protegida",
      descripcion: `ML está protegiendo tu nivel actual. Tu reputación real es ${real}. Aprovechá este período para corregir reclamos, cancelaciones y demoras antes de que la protección expire.`,
      accion_concreta:
        "Priorizá resolver reclamos abiertos, bajar cancelaciones y cumplir envíos: son las palancas que destraban el nivel real.",
      metrica_afectada: "ml_reputation_protection",
      impacto_estimado: "Alto — transición brusca cuando cese la protección",
      benchmark_objetivo: "Alinear operación al nivel mostrado públicamente",
      audiencia: "manager",
      bloque: "01 Salud"
    });
  }

  // 2.2 — Listing quota
  const quota = input.listings_quota;
  const totalItems = input.listings_total_items;
  if (typeof quota === "number" && quota > 0 && typeof totalItems === "number" && totalItems / quota > 0.85) {
    const pct = Math.round((totalItems / quota) * 100);
    out.push({
      id: `${id}-ml-signal-cupo-publicaciones`,
      categoria: "publicaciones",
      prioridad: "alta",
      titulo: "Cupo de publicaciones al límite",
      descripcion: `Estás usando ${pct}% de tu cupo (${totalItems}/${quota} publicaciones). Cerca del límite, ML puede restringir nuevas publicaciones.`,
      accion_concreta: "Revisá catálogo duplicado, pausas innecesarias y el nivel que determina el cupo en tu sitio.",
      metrica_afectada: "ml_listings_capacity",
      impacto_estimado: "Alto — riesgo de no poder publicar",
      benchmark_objetivo: "Mantener uso de cupo bajo un margen operativo seguro",
      audiencia: "operator",
      bloque: "02 Publicaciones"
    });
  }

  // 2.3 — Full/Flex + ventas_totales (snapshot)
  const fullPct = input.uso_full_flex_pct;
  const ventasTot = input.ventas_totales;
  if (typeof fullPct === "number" && fullPct < 50 && typeof ventasTot === "number" && ventasTot > 100) {
    out.push({
      id: `${id}-ml-signal-full-flex-critico`,
      categoria: "logistica",
      prioridad: "urgente",
      titulo: "Full/Flex crítico con volumen de ventas activo",
      descripcion: `Con ${fmt(ventasTot)} ventas/mes y ${fmt(fullPct)}% en Full/Flex, perdés posicionamiento frente a vendedores con logística ML.`,
      accion_concreta: `Subí Full/Flex en SKUs de mayor rotación: con ${fmt(ventasTot)} de volumen, la visibilidad orgánica depende de logística MLA.`,
      metrica_afectada: "ml_full_flex_positioning",
      impacto_estimado: "Urgente — visibilidad en búsqueda",
      benchmark_objetivo: "Full/Flex en la mayor parte de ventas relevantes",
      audiencia: "operator",
      bloque: "04 Logistica"
    });
  }

  // 2.4 — ACOS vs margin break-even (ACOS% vs 100/margen_pre_ads)
  const m = input.margen_pre_ads;
  const acos = input.acos;
  if (typeof m === "number" && m > 0 && typeof acos === "number" && acos > 100 / m) {
    const breakevenAcos = Math.round((100 / m) * 100) / 100;
    out.push({
      id: `${id}-ml-signal-acos-breakeven-margen`,
      categoria: "ads",
      prioridad: "urgente",
      titulo: "ACOS supera el break-even de tu margen",
      descripcion: `Con margen del ${fmt(m)}%, tu break-even es ${breakevenAcos}% ACOS. Tu ACOS actual de ${fmt(acos, 1)}% destruye margen en cada venta por ads.`,
      accion_concreta: `Pausá o bajá puja en campañas con ACOS por encima de ${breakevenAcos}% hasta recuperar unidad de contribución positiva.`,
      metrica_afectada: "ml_acos_margen_breakeven",
      impacto_estimado: "Urgente — destrucción de margen por ad",
      benchmark_objetivo: `ACOS < ${breakevenAcos}% dado el margen ${fmt(m)}%`,
      audiencia: "manager",
      bloque: "03 Ads"
    });
  }

  // 2.5 — Stock-out risk
  const dias = input.dias_stock;
  const skus = input.skus_sin_stock_pct;
  if (typeof dias === "number" && dias < 15 && typeof skus === "number" && skus > 5) {
    out.push({
      id: `${id}-ml-signal-riesgo-quiebre`,
      categoria: "stock",
      prioridad: "urgente",
      titulo: "Riesgo de quiebre de stock esta semana",
      descripcion: `Tenés ${fmt(dias)} días de stock y ${fmt(skus, 1)}% de SKUs sin stock. Sin reposición urgente, perderás ventas antes de fin de semana.`,
      accion_concreta: "Reponé SKUs con mayor demanda y ajustá previsión para evitar nuevos quiebres de cara al fin de semana.",
      metrica_afectada: "ml_stock_out_velocity",
      impacto_estimado: "Urgente — ventas y reputación",
      benchmark_objetivo: "SKUs sin stock <5% y cobertura adecuada a la velocidad de venta",
      audiencia: "operator",
      bloque: "05 Stock"
    });
  }

  // 2.6 — Mercado Líder candidato
  const sellerLevel = input.nivel_vendedor?.trim();
  const completed = input.ventas_completadas_60d;
  if (!sellerLevel && typeof completed === "number" && completed > 50) {
    out.push({
      id: `${id}-ml-signal-mercado-lider-candidato`,
      categoria: "salud",
      prioridad: "media",
      titulo: "A un paso de ser Mercado Líder",
      descripcion: `Con ${fmt(completed)} ventas en 60 días, cumplís el volumen mínimo. Mantené reclamos <0.5%, cancelaciones <0.2% y demoras <3% para calificar.`,
      accion_concreta: `Trabajá en reclamos, cancelaciones y plazos de envío: con ${fmt(completed)} ventas en 60d estás cerca de los requisitos de ML.`,
      metrica_afectada: "ml_power_seller_track",
      impacto_estimado: "Medio — visibilidad y confianza de compra",
      benchmark_objetivo: "Umbrales MLA para Mercado Líder en el período vigente",
      audiencia: "manager",
      bloque: "01 Salud"
    });
  }

  return out;
}
