export type MlDataSource = "api" | "scraper" | "manual" | "unavailable";

export type MlDiagnosticPrefill = {
  reclamos?: number | null;
  mediaciones?: number | null;
  cancelaciones_vendedor?: number | null;
  envios_a_tiempo?: number | null;
  pubs_activas_pct?: number | null;
  pubs_optimizadas_pct?: number | null;
  ctr?: number | null;
  gasto_ads?: number | null;
  ventas_ads?: number | null;
  ventas_totales?: number | null;
  acos?: number | null;
  roas?: number | null;
  tacos?: number | null;
  incidencias_pct?: number | null;
  uso_full_flex_pct?: number | null;
  cancelaciones_stock_pct?: number | null;
  skus_sin_stock_pct?: number | null;
  dias_stock?: number | null;
  lead_time_reposicion?: number | null;
  seller_id: string;
  synced_at: string;
  data_sources: Record<string, MlDataSource>;
};

export type MlTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: number;
  token_type?: string;
  scope?: string;
};

export type MlStoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export type MlSellerReputationResponse = {
  level_id: string | null;
  power_seller_status: string | null;
  transactions?: {
    period?: string;
    ratings?: {
      positive?: number;
      neutral?: number;
      negative?: number;
    };
    canceled?: number;
    completed?: number;
  };
  metrics?: {
    sales?: { period?: string; completed?: number; declined?: number };
    claims?: { period?: string; rate?: number; value?: number };
    delayed_handling_time?: { period?: string; rate?: number; value?: number };
    cancellations?: { period?: string; rate?: number; value?: number };
  };
};

/** Respuesta parcial de GET /users/{id}; solo lo que usamos para reputación. */
export type MlUserResponse = {
  id?: number;
  seller_reputation?: MlSellerReputationResponse | null;
};

export type MlListingsSearchResponse = {
  results: string[];
  paging: {
    total: number;
    offset?: number;
    limit?: number;
  };
};

export type MlItemPerformanceResponse = {
  score?: number;
  level_wording?: string;
  buckets?: Array<{ id?: string; title?: string; score?: number }>;
};

export type MlAdvertiserResponse = {
  advertiser_id?: number;
  user_id?: number;
};

export type MlAdsReportRow = {
  spend?: number;
  advertised_sales?: number;
  total_amount?: number;
  units_quantity?: number;
  advertising_items_quantity?: number;
  roas?: number;
  cvr?: number;
};

export type MlAdsReportResponse = {
  results?: MlAdsReportRow[];
};

export type MlOrdersSearchResponse = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: Array<{
    id?: number;
    status?: string;
    cancel_detail?: { description?: string | null };
    shipping?: {
      id?: number;
      status?: string | null;
      substatus?: string | null;
    } | null;
  }>;
};

export type MlItemDetailResponse = {
  id: string;
  available_quantity?: number;
  inventory_id?: string | null;
};

export type MlFulfillmentOperationsResponse = {
  results?: Array<{
    available_quantity?: number;
  }>;
};
