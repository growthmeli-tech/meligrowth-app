import { mlFetch } from "@/lib/ml/client";
import type {
  MlFulfillmentOperationsResponse,
  MlItemDetailResponse,
  MlListingsSearchResponse
} from "@/lib/ml/mappers/types";

const ITEM_PAGE_SIZE = 50;
const ITEM_DETAIL_BATCH_SIZE = 10;
const MAX_STOCK_ITEMS = 120;

async function getActiveItemIds(sellerId: string, accessToken: string) {
  const itemIds: string[] = [];

  for (let offset = 0; offset < MAX_STOCK_ITEMS; offset += ITEM_PAGE_SIZE) {
    const response = await mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { status: "active", limit: ITEM_PAGE_SIZE, offset }
    });
    itemIds.push(...response.results);
    if (response.results.length < ITEM_PAGE_SIZE) break;
  }

  return itemIds.slice(0, MAX_STOCK_ITEMS);
}

async function getItemDetails(itemIds: string[], accessToken: string) {
  const details: MlItemDetailResponse[] = [];

  for (let i = 0; i < itemIds.length; i += ITEM_DETAIL_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + ITEM_DETAIL_BATCH_SIZE);
    const responses = await Promise.allSettled(
      batch.map((itemId) =>
        mlFetch<MlItemDetailResponse>(`/items/${itemId}`, {
          token: accessToken,
          query: { attributes: "id,available_quantity,inventory_id" }
        })
      )
    );

    for (const response of responses) {
      if (response.status === "fulfilled") {
        details.push(response.value);
      }
    }
  }

  return details;
}

async function getFulfillmentAvailableByInventory(
  sellerId: string,
  inventoryId: string,
  accessToken: string
) {
  const response = await mlFetch<MlFulfillmentOperationsResponse>("/stock/fulfillment/operations/search", {
    token: accessToken,
    query: {
      seller_id: sellerId,
      inventory_id: inventoryId
    }
  });

  return (response.results ?? []).reduce((acc, row) => acc + (row.available_quantity ?? 0), 0);
}

export async function getStockMetrics(sellerId: string, accessToken: string) {
  const itemIds = await getActiveItemIds(sellerId, accessToken);
  if (!itemIds.length) {
    return {
      skus_sin_stock_pct: 0,
      dias_stock: null,
      lead_time_reposicion: null
    };
  }

  const details = await getItemDetails(itemIds, accessToken);
  if (!details.length) {
    return {
      skus_sin_stock_pct: null,
      dias_stock: null,
      lead_time_reposicion: null
    };
  }

  const noStock = details.filter((item) => (item.available_quantity ?? 0) <= 0).length;
  const sampleWithInventory = details.filter((item) => Boolean(item.inventory_id)).slice(0, 3);

  await Promise.allSettled(
    sampleWithInventory.map((item) =>
      getFulfillmentAvailableByInventory(sellerId, item.inventory_id as string, accessToken)
    )
  );

  return {
    skus_sin_stock_pct: (noStock / details.length) * 100,
    dias_stock: null,
    lead_time_reposicion: null
  };
}
