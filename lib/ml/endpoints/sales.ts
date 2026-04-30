import { mlFetch } from "@/lib/ml/client";

export interface SkuSalesData {
  item_id: string;
  units_sold_30d: number;
  revenue_30d: number;
  last_sale_date: string | null;
}

interface OrdersSearchResponse {
  results?: unknown[];
  paging?: { total?: number; offset?: number; limit?: number };
}

interface MlOrderItem {
  quantity?: number;
  unit_price?: number;
  full_unit_price?: number;
  item?: { id?: string };
}

interface MlOrderDetail {
  id?: number | string;
  date_created?: string;
  order_items?: MlOrderItem[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOrderDetail(raw: unknown): MlOrderDetail | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as MlOrderDetail;
}

function aggregateOrderInto(
  map: Map<string, { units: number; revenue: number; lastSale: string | null }>,
  order: MlOrderDetail
) {
  const orderDate = typeof order.date_created === "string" ? order.date_created : null;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  for (const line of items) {
    const itemId = line.item && typeof line.item.id === "string" ? line.item.id : null;
    if (!itemId) continue;
    const qtyRaw = line.quantity;
    const qty = typeof qtyRaw === "number" && Number.isFinite(qtyRaw) ? qtyRaw : Number(qtyRaw) || 0;
    if (qty <= 0) continue;
    const unitRaw =
      typeof line.unit_price === "number" && Number.isFinite(line.unit_price)
        ? line.unit_price
        : typeof line.full_unit_price === "number" && Number.isFinite(line.full_unit_price)
          ? line.full_unit_price
          : Number(line.unit_price);
    const unit = Number.isFinite(unitRaw) ? unitRaw : 0;
    const lineRevenue = unit * qty;
    const prev = map.get(itemId) ?? { units: 0, revenue: 0, lastSale: null as string | null };
    prev.units += qty;
    prev.revenue += lineRevenue;
    if (orderDate) {
      if (!prev.lastSale || orderDate > prev.lastSale) prev.lastSale = orderDate;
    }
    map.set(itemId, prev);
  }
}

/**
 * Paid orders last 30 days, aggregated by catalog item id.
 * Never throws — returns [] on failure.
 */
export async function getSalesLast30Days(sellerId: string, accessToken: string): Promise<SkuSalesData[]> {
  const started = Date.now();
  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const aggregate = new Map<string, { units: number; revenue: number; lastSale: string | null }>();
  let totalOrders = 0;

  try {
    for (let page = 0; page < 10; page += 1) {
      const offset = page * 50;
      let search: OrdersSearchResponse;
      try {
        search = await mlFetch<OrdersSearchResponse>("/orders/search", {
          token: accessToken,
          query: {
            seller: sellerId,
            "order.status": "paid",
            "order.date_created.from": dateFrom,
            limit: 50,
            offset
          }
        });
      } catch {
        break;
      }

      const rawResults = search.results ?? [];
      if (rawResults.length === 0) break;

      for (const entry of rawResults) {
        if (typeof entry === "number" || typeof entry === "string") {
          try {
            const detail = await mlFetch<unknown>(`/orders/${entry}`, { token: accessToken });
            const parsed = parseOrderDetail(detail);
            if (parsed) {
              aggregateOrderInto(aggregate, parsed);
              totalOrders += 1;
            }
          } catch {
            /* skip bad order */
          }
          await sleep(40);
        } else if (entry && typeof entry === "object" && "order_items" in entry) {
          const parsed = parseOrderDetail(entry);
          if (parsed) {
            aggregateOrderInto(aggregate, parsed);
            totalOrders += 1;
          }
        }
      }

      if (rawResults.length < 50) break;
      await sleep(200);
    }
  } catch {
    return [];
  }

  const uniqueItems = aggregate.size;
  const durationMs = Date.now() - started;
  console.info("[ml-sales:sync]", {
    sellerId,
    totalOrders,
    uniqueItems,
    durationMs
  });

  const out: SkuSalesData[] = [];
  for (const [item_id, v] of aggregate) {
    out.push({
      item_id,
      units_sold_30d: v.units,
      revenue_30d: Math.round(v.revenue * 100) / 100,
      last_sale_date: v.lastSale
    });
  }
  return out;
}
