import { mlFetch } from "@/lib/ml/client";
import type { MlItemPerformanceResponse, MlListingsSearchResponse } from "@/lib/ml/mappers/types";

const PERFORMANCE_SAMPLE_SIZE = 40;
const PERFORMANCE_BATCH_SIZE = 10;

export async function getListingsStats(sellerId: string, accessToken: string) {
  const [active, all, paused] = await Promise.all([
    mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { status: "active", limit: 1 }
    }),
    mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { limit: 1 }
    }),
    mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { status: "paused", limit: 1 }
    })
  ]);

  return {
    total: all.paging.total,
    active: active.paging.total,
    paused: paused.paging.total
  };
}

async function getActiveItemIds(sellerId: string, accessToken: string) {
  const response = await mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
    token: accessToken,
    query: {
      status: "active",
      limit: PERFORMANCE_SAMPLE_SIZE
    }
  });
  return response.results;
}

export async function getListingsOptimizationRate(sellerId: string, accessToken: string) {
  const itemIds = await getActiveItemIds(sellerId, accessToken);
  if (!itemIds.length) return 0;

  let optimized = 0;

  for (let i = 0; i < itemIds.length; i += PERFORMANCE_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + PERFORMANCE_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((itemId) =>
        mlFetch<MlItemPerformanceResponse>(`/item/${itemId}/performance`, {
          token: accessToken
        })
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled" && typeof result.value.score === "number" && result.value.score >= 70) {
        optimized += 1;
      }
    }
  }

  return (optimized / itemIds.length) * 100;
}

export function mapListingsToDiagnostic(
  stats: { total: number; active: number },
  optimizationRate: number
) {
  return {
    pubs_activas_pct: stats.total > 0 ? (stats.active / stats.total) * 100 : 0,
    pubs_optimizadas_pct: optimizationRate,
    ctr: null
  };
}
