import type { Database } from "@/lib/supabase/database.types";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export const TRADUCCIONES_METRICAS: Record<string, string> = {
  uso_full_flex_pct: "Uso Full/Flex",
  envios_a_tiempo: "Envíos a tiempo",
  reclamos: "Reclamos de compradores",
  mediaciones: "Mediaciones activas",
  cancelaciones_vendedor: "Cancelaciones por tu error",
  pubs_activas_pct: "Publicaciones activas",
  pubs_optimizadas_pct: "Publicaciones optimizadas",
  ctr: "Tasa de clicks",
  acos: "Eficiencia publicitaria (ACOS)",
  roas: "Retorno en publicidad (ROAS)",
  tacos: "Costo total de publicidad (TACOS)",
  incidencias_pct: "Incidencias logísticas",
  cancelaciones_stock_pct: "Cancelaciones por falta de stock",
  skus_sin_stock_pct: "SKUs sin stock",
  dias_stock: "Días de stock disponible",
  lead_time_reposicion: "Tiempo de reposición"
};

export const ACCIONES_POR_METRICA: Record<string, string> = {
  uso_full_flex_pct: "Enviá más SKUs a Full. Empezá por los de mayor rotación.",
  envios_a_tiempo: "Urgente: penalización activa posible. Revisá SLA con logística.",
  reclamos: "Revisá proceso post-venta. Objetivo: llevar a <0.5%.",
  mediaciones: "Auditá causas. Objetivo: llevar a <0.2%.",
  cancelaciones_vendedor: "Revisá stock real vs publicado.",
  pubs_activas_pct: "Auditá catálogo. Reactivá top SKUs pausados.",
  acos: "ACOS supera el margen. Pausá campañas hasta revisar estructura de costos.",
  roas: "ROAS por debajo del break-even. Pausá y rediseñá estrategia.",
  incidencias_pct: "Auditá causas de incidencia. Objetivo: <0.7%.",
  cancelaciones_stock_pct: "Mejorá reposición de top SKUs.",
  skus_sin_stock_pct: "Reponé SKUs sin stock detectados. Objetivo: <2%."
};

export const OPS_BLOCKS = [
  { key: "salud", label: "Salud", number: "01", weight: 35 },
  { key: "publicaciones", label: "Publicaciones", number: "02", weight: 20 },
  { key: "ads", label: "Ads", number: "03", weight: 20 },
  { key: "logistica", label: "Logística", number: "04", weight: 15 },
  { key: "stock", label: "Stock", number: "05", weight: 10 }
] as const;

export type OpsBlockKey = (typeof OPS_BLOCKS)[number]["key"];

export function translateOperationalCopy(text: string): string {
  let result = text;
  for (const [technical, translated] of Object.entries(TRADUCCIONES_METRICAS)) {
    const pattern = new RegExp(technical, "gi");
    result = result.replace(pattern, translated);
  }
  return result.replaceAll("_", " ");
}

export function metricFromAlert(alert: Pick<AlertRow, "categoria" | "titulo" | "descripcion" | "accion_concreta">): string | null {
  const blob = `${alert.categoria ?? ""} ${alert.titulo ?? ""} ${alert.descripcion ?? ""} ${alert.accion_concreta ?? ""}`.toLowerCase();
  for (const technicalKey of Object.keys(TRADUCCIONES_METRICAS)) {
    if (blob.includes(technicalKey.toLowerCase())) return technicalKey;
  }
  if (blob.includes("acos")) return "acos";
  if (blob.includes("roas")) return "roas";
  if (blob.includes("tacos")) return "tacos";
  return null;
}

export function blockFromAlertCategory(category: string | null): OpsBlockKey {
  if (category === "salud") return "salud";
  if (category === "publicaciones") return "publicaciones";
  if (category === "ads") return "ads";
  if (category === "logistica") return "logistica";
  return "stock";
}

export function getOperationalPriorityCopy(alert: Pick<AlertRow, "categoria" | "titulo" | "descripcion" | "accion_concreta" | "prioridad">) {
  const metric = metricFromAlert(alert);
  const fallbackTitle = alert.accion_concreta || alert.titulo;
  const actionTitle = metric ? ACCIONES_POR_METRICA[metric] ?? fallbackTitle : fallbackTitle;
  return {
    title: toShortSentence(translateOperationalCopy(actionTitle)),
    subtitle: translateAlertDescription(alert.descripcion || alert.titulo || "Revisá el detalle para avanzar."),
    block: blockFromAlertCategory(alert.categoria),
    priority: alert.prioridad
  };
}

export function translateAlertDescription(text: string): string {
  const normalized = text.trim();
  const metricPattern = /([a-z_]+)\s+en estado\s+[a-z_]+\s+con valor actual\s+([0-9.,-]+)\.?\s+brecha estimada:\s*([0-9.,-]+)\.?/i;
  const match = normalized.match(metricPattern);

  if (!match) {
    return translateOperationalCopy(
      normalized
        .replace(/brecha estimada:\s*([0-9.,-]+)/gi, "Objetivo: $1%")
        .replace(/valor actual\s*([0-9.,-]+)/gi, "valor actual $1")
    );
  }

  const metric = match[1].toLowerCase();
  const value = Number.parseFloat(match[2].replace(",", "."));
  const gap = Number.parseFloat(match[3].replace(",", "."));
  if (!Number.isFinite(value) || !Number.isFinite(gap)) return translateOperationalCopy(normalized);

  if (metric === "uso_full_flex_pct") {
    return `Solo el ${formatNumber(value)}% de tus envíos usan Full/Flex. Llevá ese número a ${formatNumber(value + gap)}%.`;
  }

  if (metric === "envios_a_tiempo") {
    return `El ${formatNumber(value)}% de tus pedidos llegan a tiempo. Necesitás llegar al ${formatNumber(value + gap)}% para evitar penalizaciones.`;
  }

  if (metric === "reclamos") {
    return `Tus reclamos están en ${formatNumber(value)}%. Objetivo: bajar a ${formatNumber(Math.max(0, value - gap))}%.`;
  }

  if (metric === "pubs_activas_pct") {
    return `El ${formatNumber(value)}% de tus publicaciones están activas. Objetivo: ${formatNumber(value + gap)}% para máxima visibilidad.`;
  }

  const translatedMetric = TRADUCCIONES_METRICAS[metric] ?? translateOperationalCopy(metric);
  const targetValue = metric.includes("reclamos") || metric.includes("cancelaciones") || metric.includes("incidencias") ? Math.max(0, value - gap) : value + gap;
  return `${translatedMetric}: valor actual ${formatNumber(value)}. Objetivo: ${formatNumber(targetValue)}%.`;
}

function toShortSentence(text: string): string {
  const [firstSentence] = text.split(".");
  return firstSentence?.trim() || text;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
