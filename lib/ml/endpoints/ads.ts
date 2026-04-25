import { mlFetch } from "@/lib/ml/client";
import type { MlAdsReportResponse, MlAdvertiserResponse } from "@/lib/ml/mappers/types";

export async function getAdvertiserId(accessToken: string) {
  const response = await mlFetch<MlAdvertiserResponse[] | { results?: MlAdvertiserResponse[] }>(
    "/advertising/advertisers",
    {
      token: accessToken,
      query: { product_id: "PADS" },
      headers: { "Api-Version": "1" }
    }
  );

  const advertisers = Array.isArray(response) ? response : response.results ?? [];
  const advertiser = advertisers.find((row) => typeof row.advertiser_id === "number");
  return advertiser?.advertiser_id ?? null;
}

export async function getAdsMetrics(advertiserId: number, accessToken: string, dateFrom: string, dateTo: string) {
  const metrics = await mlFetch<MlAdsReportResponse>(
    `/advertising/advertisers/${advertiserId}/product_ads/reports`,
    {
      token: accessToken,
      headers: { "Api-Version": "1" },
      query: {
        date_from: dateFrom,
        date_to: dateTo,
        metrics: "spend,advertised_sales,total_amount,units_quantity,roas,cvr"
      }
    }
  );

  const rows = metrics.results ?? [];
  const totals = rows.reduce<{ spend: number; ventas_ads: number; ventas_totales: number }>(
    (acc, row) => ({
      spend: acc.spend + (row.spend ?? 0),
      ventas_ads: acc.ventas_ads + (row.advertised_sales ?? 0),
      ventas_totales: acc.ventas_totales + (row.total_amount ?? 0)
    }),
    { spend: 0, ventas_ads: 0, ventas_totales: 0 }
  );

  return totals;
}

export function mapAdsToDiagnostic(metrics: { spend: number; ventas_ads: number; ventas_totales: number } | null) {
  if (!metrics) {
    return {
      gasto_ads: null,
      ventas_ads: null,
      ventas_totales: null,
      acos: null,
      roas: null,
      tacos: null
    };
  }

  const roas = metrics.spend > 0 ? metrics.ventas_ads / metrics.spend : null;
  const acos = metrics.ventas_ads > 0 ? (metrics.spend / metrics.ventas_ads) * 100 : null;
  const tacos = metrics.ventas_totales > 0 ? (metrics.spend / metrics.ventas_totales) * 100 : null;

  return {
    gasto_ads: metrics.spend,
    ventas_ads: metrics.ventas_ads,
    ventas_totales: metrics.ventas_totales,
    acos,
    roas,
    tacos
  };
}
