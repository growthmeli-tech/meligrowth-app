import type { Json } from "@/lib/supabase/database.types";
import type { SellingPriceResult } from "@/lib/pricing/calculator";

export type TemplateType = "skus_stock" | "margenes_costos" | "ficha_tecnica" | "pricing_comercial" | "unknown";

export interface ParseErrorEntry {
  row: number;
  field: string;
  message: string;
}

export interface ParseResult<T> {
  valid: T[];
  errors: ParseErrorEntry[];
}

export interface IngestionResult {
  success: boolean;
  rows_processed: number;
  metrics_updated: Record<string, number | string>;
  alerts_generated: number;
  errors: string[];
  log_id?: string;
}

export interface SkusStockRow {
  sku: string;
  producto: string;
  stock: number;
  dias_stock: number | null;
}

export interface MargenesRow {
  sku: string | null;
  producto: string;
  costo: number;
  peso_kg: number | null;
  logistica: "Full" | "Flex" | "Retiro domicilio";
  reputacion: "Verde / MercadoLíder" | "Naranja o Roja";
  publicidad_pct: number;
  margen_pct: number | null;
  notas?: string | null;
  /** Set by parseMargenesCostosRows via calcSellingPrice */
  selling?: SellingPriceResult;
}

export interface FichaTecnicaRow {
  sku: string;
  titulo: string;
  descripcion: string | null;
  atributos: Json;
}

export interface PricingComercialRow {
  plan: string;
  current_revenue: number;
  projected_revenue: number;
  gross_margin_pct: number;
  delivery_cost: number;
  setup_fee: number;
  months: number;
}
