import { mlFetch } from "@/lib/ml/client";
import type { MlListingsSearchResponse, MlOrdersSearchResponse } from "@/lib/ml/mappers/types";

const ORDER_PAGE_SIZE = 50;
const MAX_ORDER_PAGES = 4;

async function fetchOrders(
  sellerId: string,
  accessToken: string,
  query: Record<string, string | number>,
  maxPages = MAX_ORDER_PAGES
) {
  const results: NonNullable<MlOrdersSearchResponse["results"]> = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * ORDER_PAGE_SIZE;
    const response = await mlFetch<MlOrdersSearchResponse>("/orders/search", {
      token: accessToken,
      query: {
        seller: sellerId,
        limit: ORDER_PAGE_SIZE,
        offset,
        ...query
      }
    });

    const pageResults = response.results ?? [];
    if (!pageResults.length) break;
    results.push(...pageResults);
    if (pageResults.length < ORDER_PAGE_SIZE) break;
  }

  return results;
}

function isIncidentOrder(order: NonNullable<MlOrdersSearchResponse["results"]>[number]) {
  const shipping = order.shipping;
  if (!shipping) return false;
  return Boolean(
    shipping.substatus ||
      (shipping.status && !["delivered", "shipped", "ready_to_ship"].includes(shipping.status))
  );
}

function isStockCancellation(order: NonNullable<MlOrdersSearchResponse["results"]>[number]) {
  const reason = (order.cancel_detail?.description ?? "").toLowerCase();
  return order.status === "cancelled" && (reason.includes("stock") || reason.includes("sin stock") || reason.includes("out_of_stock"));
}

export async function getLogisticsMetrics(sellerId: string, accessToken: string) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const dateFrom = fromDate.toISOString();

  const [paidOrders, cancelledOrders, fullItems, activeItems] = await Promise.all([
    fetchOrders(sellerId, accessToken, {
      "order.date_created.from": dateFrom,
      "order.status": "paid"
    }),
    fetchOrders(sellerId, accessToken, {
      "order.date_created.from": dateFrom,
      "order.status": "cancelled"
    }),
    mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { logistic_type: "fulfillment", limit: 1 }
    }),
    mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: { status: "active", limit: 1 }
    })
  ]);

  const totalOrders = paidOrders.length;
  const incidentOrders = paidOrders.filter(isIncidentOrder).length;
  const stockCancelled = cancelledOrders.filter(isStockCancellation).length;
  const fullFlexPct = activeItems.paging.total > 0 ? (fullItems.paging.total / activeItems.paging.total) * 100 : 0;

  return {
    incidencias_pct: totalOrders > 0 ? (incidentOrders / totalOrders) * 100 : 0,
    cancelaciones_stock_pct: totalOrders > 0 ? (stockCancelled / totalOrders) * 100 : 0,
    uso_full_flex_pct: fullFlexPct
  };
}
