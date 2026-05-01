import { mlFetch, MlApiError } from "@/lib/ml/client";
import type { MlItemCatalogBody, MlItemsMultiEntry, MlListingsSearchResponse } from "@/lib/ml/mappers/types";

const SEARCH_PAGE = 50;
const BATCH_IDS = 20;
const BATCH_DELAY_MS = 100;

export interface MlCatalogItem {
  item_id: string;
  title: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  status: "active" | "paused" | "closed";
  seller_custom_field: string | null;
  condition: string;
  permalink: string;
  thumbnail: string | null;
  logistic_type: string | null;
  /** ML `shipping.free_shipping` — política comercial, distinta del modo logístico. */
  free_shipping: boolean | null;
  /** False cuando la clave `free_shipping` no viene en `shipping` (bug de integración / payload incompleto). */
  free_shipping_key_present: boolean;
  /** ML `shipping.mode` (me2, custom, …). */
  shipping_mode: string | null;
  /** Peso empaquetado (kg) desde `shipping.dimensions` cuando ML lo envía. */
  package_weight_kg: number | null;
  /** ML `shipping.tags` — señales p.ej. Flex (`self_service`). */
  shipping_tags: string[];
  /** ML `shipping.methods` — estructura variable por sitio. */
  shipping_methods: unknown[];
  /** ML `shipping.dimensions` raw string when present. */
  shipping_dimensions: string | null;
  local_pick_up: boolean | null;
  store_pick_up: boolean | null;
  listing_type_id: string | null;
  category_id: string | null;
  catalog_product_id: string | null;
  last_updated: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(raw: string | undefined): "active" | "paused" | "closed" {
  const s = (raw ?? "").toLowerCase();
  if (s === "paused") return "paused";
  if (s === "closed" || s === "inactive" || s === "under_review") return "closed";
  return "active";
}

function parseItemBody(body: Record<string, unknown>): MlCatalogItem | null {
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return null;

  const shipping = body.shipping && typeof body.shipping === "object" ? (body.shipping as MlItemCatalogBody["shipping"]) : null;
  const logisticType =
    typeof shipping?.logistic_type === "string"
      ? shipping.logistic_type
      : typeof (body as { logistic_type?: string }).logistic_type === "string"
        ? (body as { logistic_type: string }).logistic_type
        : null;

  let free_shipping: boolean | null = null;
  let free_shipping_key_present = false;
  let shipping_mode: string | null = null;
  let package_weight_kg: number | null = null;
  let shipping_dimensions: string | null = null;
  let local_pick_up: boolean | null = null;
  let store_pick_up: boolean | null = null;
  const shipping_tags: string[] = [];
  const shipping_methods: unknown[] = [];
  if (shipping && typeof shipping === "object") {
    const sh = shipping as Record<string, unknown>;
    free_shipping_key_present = Object.prototype.hasOwnProperty.call(sh, "free_shipping");
    if (typeof sh.free_shipping === "boolean") free_shipping = sh.free_shipping;
    else if (sh.free_shipping === null) free_shipping = null;
    if (typeof sh.mode === "string" && sh.mode.trim()) shipping_mode = sh.mode.trim();
    if (typeof sh.dimensions === "string" && sh.dimensions.trim()) {
      const dim = sh.dimensions.trim();
      shipping_dimensions = dim;
      const comma = dim.lastIndexOf(",");
      if (comma >= 0) {
        const tail = dim.slice(comma + 1).replace(/[^\d.]/g, "");
        const wn = Number(tail);
        if (Number.isFinite(wn) && wn > 0) {
          package_weight_kg = wn / 1000;
        }
      }
    }
    if (typeof sh.local_pick_up === "boolean") local_pick_up = sh.local_pick_up;
    else if (sh.local_pick_up === null) local_pick_up = null;
    if (typeof sh.store_pick_up === "boolean") store_pick_up = sh.store_pick_up;
    else if (sh.store_pick_up === null) store_pick_up = null;
    if (Array.isArray(sh.tags)) {
      for (const t of sh.tags) {
        if (typeof t === "string" && t.trim()) shipping_tags.push(t.trim());
      }
    }
    if (Array.isArray(sh.methods)) {
      for (const m of sh.methods) shipping_methods.push(m);
    }
  }

  let sellerSku: string | null =
    typeof body.seller_custom_field === "string" && body.seller_custom_field.trim()
      ? body.seller_custom_field.trim()
      : null;
  if (!sellerSku && Array.isArray(body.attributes)) {
    for (const attr of body.attributes) {
      if (!attr || typeof attr !== "object") continue;
      const a = attr as { id?: string; value_name?: string; value_id?: string };
      if (a.id === "SELLER_SKU" && typeof a.value_name === "string" && a.value_name.trim()) {
        sellerSku = a.value_name.trim();
        break;
      }
    }
  }

  const price = typeof body.price === "number" ? body.price : Number(body.price);
  const title = typeof body.title === "string" ? body.title : "";

  const aq = body.available_quantity;
  const available_quantity = typeof aq === "number" ? aq : Number(aq);

  const sq = body.sold_quantity;
  const sold_quantity = typeof sq === "number" && Number.isFinite(sq) ? sq : typeof sq === "string" ? Number(sq) || 0 : 0;

  const thumb =
    typeof body.thumbnail === "string"
      ? body.thumbnail
      : Array.isArray(body.pictures) && body.pictures[0] && typeof (body.pictures[0] as { secure_url?: string }).secure_url === "string"
        ? (body.pictures[0] as { secure_url: string }).secure_url
        : null;

  const lastUpdated =
    typeof body.last_updated === "string"
      ? body.last_updated
      : typeof body.date_created === "string"
        ? body.date_created
        : new Date().toISOString();

  const listing_type_id =
    typeof body.listing_type_id === "string" && body.listing_type_id.trim() ? body.listing_type_id.trim() : null;
  const category_id = typeof body.category_id === "string" && body.category_id.trim() ? body.category_id.trim() : null;
  const catalog_product_id =
    typeof body.catalog_product_id === "string" && body.catalog_product_id.trim() ? body.catalog_product_id.trim() : null;

  return {
    item_id: id,
    title,
    price: Number.isFinite(price) ? price : 0,
    available_quantity: Number.isFinite(available_quantity) ? available_quantity : 0,
    sold_quantity,
    status: normalizeStatus(typeof body.status === "string" ? body.status : undefined),
    seller_custom_field: sellerSku,
    condition: typeof body.condition === "string" ? body.condition : "",
    permalink: typeof body.permalink === "string" ? body.permalink : "",
    thumbnail: thumb,
    logistic_type: logisticType,
    free_shipping,
    free_shipping_key_present,
    shipping_mode,
    package_weight_kg,
    shipping_tags,
    shipping_methods,
    shipping_dimensions,
    local_pick_up,
    store_pick_up,
    listing_type_id,
    category_id,
    catalog_product_id,
    last_updated: lastUpdated
  };
}

function unwrapMultiResponse(payload: unknown): Record<string, unknown>[] {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "id" in payload) {
    return [payload as Record<string, unknown>];
  }
  if (!Array.isArray(payload)) return [];
  const out: Record<string, unknown>[] = [];
  for (const row of payload) {
    if (row && typeof row === "object" && "body" in row && (row as MlItemsMultiEntry).body && typeof (row as MlItemsMultiEntry).body === "object") {
      const code = (row as MlItemsMultiEntry).code;
      if (code !== undefined && code !== 200) continue;
      out.push((row as MlItemsMultiEntry).body as Record<string, unknown>);
      continue;
    }
    if (row && typeof row === "object" && !("code" in row)) {
      out.push(row as Record<string, unknown>);
    }
  }
  return out;
}

async function fetchActiveItemIds(sellerId: string, accessToken: string, maxItems: number) {
  const ids: string[] = [];
  let offset = 0;

  while (ids.length < maxItems) {
    const response = await mlFetch<MlListingsSearchResponse>(`/users/${sellerId}/items/search`, {
      token: accessToken,
      query: {
        status: "active",
        limit: SEARCH_PAGE,
        offset
      }
    });

    const batch = response.results ?? [];
    ids.push(...batch);
    if (batch.length < SEARCH_PAGE) break;
    offset += SEARCH_PAGE;
    if (offset > (response.paging?.total ?? offset + 1)) break;
  }

  return ids.slice(0, maxItems);
}

export async function getItemCatalog(
  sellerId: string,
  accessToken: string,
  options?: { maxItems?: number }
): Promise<MlCatalogItem[]> {
  const maxItems = Math.min(options?.maxItems ?? 200, 500);
  const started = Date.now();
  const itemIds = await fetchActiveItemIds(sellerId, accessToken, maxItems);

  const catalog: MlCatalogItem[] = [];
  const batches = Math.ceil(itemIds.length / BATCH_IDS) || 0;
  let batchErrors = 0;

  for (let i = 0; i < itemIds.length; i += BATCH_IDS) {
    const slice = itemIds.slice(i, i + BATCH_IDS);
    const idsParam = slice.join(",");

    try {
      const raw = await mlFetch<unknown>(`/items`, {
        token: accessToken,
        query: {
          ids: idsParam,
          attributes:
            "id,title,price,available_quantity,sold_quantity,status,seller_custom_field,condition,permalink,thumbnail,listing_type_id,category_id,catalog_product_id,shipping,attributes,last_updated,pictures,date_created"
        }
      });

      const bodies = unwrapMultiResponse(raw);
      for (const body of bodies) {
        const parsed = parseItemBody(body);
        if (parsed) catalog.push(parsed);
      }
    } catch (err) {
      batchErrors += 1;
      console.error("[ml-catalog:sync] batch_failed", {
        sellerId,
        batchIndex: Math.floor(i / BATCH_IDS),
        message: err instanceof Error ? err.message : String(err)
      });
    }

    if (i + BATCH_IDS < itemIds.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const durationMs = Date.now() - started;
  console.info("[ml-catalog:sync]", {
    sellerId,
    totalItems: catalog.length,
    batches,
    durationMs,
    requestedIds: itemIds.length,
    batchErrors
  });

  return catalog;
}

export interface PricePushResult {
  item_id: string;
  success: boolean;
  new_price: number | null;
  error: string | null;
  ml_status: number | null;
}

/**
 * Updates listing price via ML API. Never throws.
 */
export async function pushPriceToML(
  itemId: string,
  newPrice: number,
  accessToken: string
): Promise<PricePushResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    console.info("[ml-price-push]", { itemId, newPrice, success: false });
    return {
      item_id: itemId,
      success: false,
      new_price: null,
      error: "Precio inválido",
      ml_status: null
    };
  }

  const rounded = Math.round(newPrice);

  try {
    await mlFetch<Record<string, unknown>>(`/items/${itemId}`, {
      token: accessToken,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: rounded })
    });
    console.info("[ml-price-push]", { itemId, newPrice: rounded, success: true });
    return {
      item_id: itemId,
      success: true,
      new_price: rounded,
      error: null,
      ml_status: 200
    };
  } catch (e) {
    const ml_status = e instanceof MlApiError ? e.statusCode : null;
    let errorMsg = e instanceof Error ? e.message : String(e);
    if (e instanceof MlApiError) {
      try {
        const raw = errorMsg.replace(/^ML API error \d+: /, "");
        const parsed = JSON.parse(raw) as { message?: string; error?: string; cause?: unknown };
        if (typeof parsed.message === "string") errorMsg = parsed.message;
        else if (typeof parsed.error === "string") errorMsg = parsed.error;
      } catch {
        /* keep message */
      }
    }
    console.info("[ml-price-push]", { itemId, newPrice: rounded, success: false });
    return {
      item_id: itemId,
      success: false,
      new_price: null,
      error: errorMsg,
      ml_status
    };
  }
}

/** Auditoría / tests: parsea body GET `/items` o `/items?ids=` (mismo contrato que sync). */
export function parseMlCatalogApiItemBody(body: Record<string, unknown>): MlCatalogItem | null {
  return parseItemBody(body);
}
