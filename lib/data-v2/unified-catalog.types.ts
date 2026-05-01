import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";
import type { MlOfficialItemState } from "@/lib/pricing/ml-official-data-contract";
import type { CatalogDataTrust, OperabilityStatus } from "@/lib/pricing/data-reliability";

export interface UnifiedCatalogItem {
  ml_row_id: string;
  item_id: string;
  title: string;
  price_ml: number | null;
  stock: number | null;
  sold_quantity: number | null;
  /** Ventas últimos 30 días cuando la ingesta ML lo provea; hoy suele ser null (ver changelog). */
  ventas_30d: number | null;
  status: string;
  logistic_type: string | null;
  permalink: string | null;
  thumbnail: string | null;
  last_synced_at: string;
  seller_custom_field: string | null;
  /** Sincronizado con ML; la UI y el motor efectivo usan resolución jerárquica + fieldSources. */
  mlOfficial: MlOfficialItemState;
  /** `ml_accounts.default_free_shipping` (no pisa un booleano ML). */
  accountDefaultFreeShipping: boolean | null;
  accountReputation: {
    sellerReputationLevel: string | null;
    sellerPowerSellerStatus: string | null;
    sellerReputationSyncedAt: string | null;
  };

  pricing_sku_id: string | null;
  sku: string | null;
  costo: number | null;
  peso_kg: number | null;
  logistica: string | null;
  /** Cuenta ML (sincronización) — copy fija según estado de reputación, sin valores nulos. */
  cuenta_reputacion_ml: string;
  reputacion: string | null;
  publicidad_pct: number | null;
  margen_pct: number | null;
  precio_calculado: number | null;
  ganancia_calculada: number | null;
  roi_calculado: number | null;

  tiene_costo: boolean;
  precio_desviado: boolean;
  stock_critico: boolean;
  margen_en_riesgo: boolean;
  sin_configurar: boolean;

  ganancia_real: number | null;
  margen_real_pct: number | null;
  comision_real: number | null;
  envio_real: number | null;
  publicidad_real: number | null;

  stock_status: "critico" | "reponer" | "saludable" | "exceso" | null;
  units_to_buy: number | null;
  days_remaining: number | null;
  stock_urgency: "urgente" | "pronto" | "ok" | null;

  precio_vs_objetivo: "sobre" | "bajo" | "ok" | null;
  desviacion_precio_pct: number | null;

  /** Estado derivado compartido con `/ops/pricing` y vistas internas. */
  decisionState: SkuDecisionState;

  /** Señales ML crudas persistidas (tags / methods) para Flex y auditoría. */
  mlShippingTags: string[];
  mlShippingMethods: unknown[];
  /** Completitud, operabilidad y confianza determinística (sin inferir ML). */
  dataTrust: CatalogDataTrust;
}

export type MlSlice = {
  price: number | null;
  available_quantity: number | null;
  status: string | null;
  pricing_sku_id: string | null;
  seller_custom_field: string | null;
  item_id: string;
  sold_quantity: number | null;
  ventas_30d: number | null;
  title?: string | null;
  thumbnail?: string | null;
  permalink?: string | null;
  revenue_30d?: number | null;
  last_sale_date?: string | null;
  logistic_type?: string | null;
  /** ML API / sync — política envío gratis (≠ modo logístico). */
  free_shipping?: boolean | null;
  /** Persistido en sync ML; null = fila legacy sin auditoría de clave. */
  ml_free_shipping_key_present?: boolean | null;
  shipping_mode?: string | null;
  condition?: string | null;
  package_weight_kg?: number | null;
  shipping_tags?: string[];
  shipping_methods?: unknown[];
};

export type MlPublicationLink = {
  item_id: string;
  permalink: string | null;
  stock: number | null;
  price_ml: number | null;
  ventas_30d?: number | null;
  revenue_30d?: number | null;
  last_sale_date?: string | null;
  logistic_type?: string | null;
  thumbnail?: string | null;
  title?: string | null;
  free_shipping?: boolean | null;
  shipping_mode?: string | null;
  condition?: string | null;
  package_weight_kg?: number | null;
  /** Cuando el link viene del catálogo unificado — gate de ejecución ML. */
  operabilityStatus?: OperabilityStatus;
};

export type CatalogHealthSummary = {
  totalPublications: number;
  activePublications: number;
  sinStock: number;
  sinCosto: number;
  precioDesviado: number;
  bienConfigurados: number;
};
