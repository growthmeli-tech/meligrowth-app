type GenericObject = Record<string, unknown>;

export function createMockMLReputation(overrides: GenericObject = {}) {
  return {
    level_id: "5_green",
    power_seller_status: "platinum",
    transactions: {
      period: "3 months",
      ratings: { positive: 0.994, negative: 0.006, neutral: 0 },
      canceled: 0.3,
      completed: 450
    },
    metrics: {
      sales: { period: "60 days", completed: 450, declined: 5 },
      claims: { period: "60 days", rate: 0.006, value: 3 },
      delayed_handling_time: { period: "60 days", rate: 0.1, value: 45 },
      cancellations: { period: "60 days", rate: 0.003, value: 1.5 }
    },
    ...overrides
  };
}

export function createMockMLPrefill(overrides: GenericObject = {}) {
  return {
    seller_id: "123456789",
    synced_at: "2026-04-24T10:00:00.000Z",
    reclamos: 0.6,
    mediaciones: 0.2,
    cancelaciones_vendedor: 0.3,
    envios_a_tiempo: 90,
    pubs_activas_pct: 64.4,
    pubs_optimizadas_pct: 70,
    ctr: null,
    gasto_ads: 20000,
    ventas_ads: 10000,
    ventas_totales: 30000,
    incidencias_pct: 1.2,
    uso_full_flex_pct: 58,
    cancelaciones_stock_pct: 0.8,
    skus_sin_stock_pct: 3.6,
    dias_stock: null,
    lead_time_reposicion: null,
    data_sources: {
      salud: "api",
      publicaciones: "api",
      ads: "api",
      logistica: "api",
      stock: "api"
    },
    ...overrides
  };
}
