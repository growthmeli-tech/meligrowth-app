import type { MlDataSource } from "@/lib/ml/mappers/types";

/** Origen persistido en `data_sources` (jsonb) por bloque o métrica. */
export type MetricDataSource = MlDataSource | null;

export type SourceBadge = {
  label: string;
  className: string;
  title: string;
};

/**
 * Presentación honesta: scraper ≠ API oficial; unavailable ≠ “mal dato”.
 */
export function getMetricSourceBadge(source: MetricDataSource): SourceBadge {
  if (source === "api") {
    return {
      label: "API",
      className: "border-green-200 bg-green-50 text-green-800",
      title: "Dato desde API oficial de Mercado Libre"
    };
  }
  if (source === "manual") {
    return {
      label: "Manual",
      className: "border-[#E8E8E2] bg-gray-50 text-[#4B4B4B]",
      title: "Ingresado o cargado manualmente por el equipo"
    };
  }
  if (source === "scraper") {
    return {
      label: "Proxy",
      className: "border-amber-200 bg-amber-50 text-amber-900",
      title: "Aproximación vía scraping o heurística — menor precisión que API oficial"
    };
  }
  if (source === "unavailable") {
    return {
      label: "Sin integración",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      title: "Bloque o métrica sin fuente conectada — no es señal de performance"
    };
  }
  return {
    label: "Origen desconocido",
    className: "border-[#E8E8E2] bg-[#F5F5F0] text-[#6B6B6B]",
    title: "No hay trazabilidad de origen para esta lectura"
  };
}
