/**
 * Server-side diagnostic: GET /items/{id} + raw vs DB trace (no tokens in stdout).
 * Run: `node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/ml-audit-shipping-payload.ts`
 * or: `npm run ml:audit-shipping`
 */
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getValidAccessToken } from "@/lib/ml/auth";
import { mlFetch } from "@/lib/ml/client";
import { parseMlCatalogApiItemBody } from "@/lib/ml/endpoints/catalog";
import { buildShippingDataTrace, classifyShippingTraceMismatch } from "@/lib/ml/shipping-data-trace";

const SENSITIVE_KEYS = new Set(
  ["access_token", "refresh_token", "authorization", "client_secret", "secret", "password", "token", "credentials"].map((s) =>
    s.toLowerCase()
  )
);

function sanitizeDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 800 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(value)) return "[redacted_jwt_like]";
    return value;
  }
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = sanitizeDeep(v);
    }
    return out;
  }
  return value;
}

function pickAuditPayload(body: Record<string, unknown>) {
  const shipping = body.shipping && typeof body.shipping === "object" ? (body.shipping as Record<string, unknown>) : null;
  return sanitizeDeep({
    id: body.id,
    title: body.title,
    price: body.price,
    available_quantity: body.available_quantity,
    status: body.status,
    listing_type_id: body.listing_type_id,
    category_id: body.category_id,
    condition: body.condition,
    catalog_product_id: body.catalog_product_id,
    shipping: shipping
      ? {
          mode: shipping.mode,
          logistic_type: shipping.logistic_type,
          free_shipping: Object.prototype.hasOwnProperty.call(shipping, "free_shipping") ? shipping.free_shipping : "__missing_key__",
          tags: shipping.tags,
          methods: shipping.methods,
          dimensions: shipping.dimensions,
          local_pick_up: shipping.local_pick_up,
          store_pick_up: shipping.store_pick_up
        }
      : null,
    sale_terms: body.sale_terms,
    attributes: body.attributes
  });
}

function envStr(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

async function main() {
  const mlAccountId = envStr("ML_ACCOUNT_ID");
  const itemIdsArg = envStr("ITEM_IDS");
  const limit = Math.min(50, Math.max(1, Number(envStr("LIMIT") ?? "10") || 10));

  const supabase = createServiceSupabaseClient();

  let accountId = mlAccountId ?? null;
  if (!accountId) {
    const { data: acc } = await supabase.from("ml_accounts").select("id").eq("active", true).limit(1).maybeSingle();
    accountId = acc?.id ?? null;
  }
  if (!accountId) {
    console.error("No ML account: set ML_ACCOUNT_ID or ensure an active ml_accounts row.");
    process.exit(1);
  }

  const { data: account, error: accErr } = await supabase
    .from("ml_accounts")
    .select("id, seller_id")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr || !account?.seller_id) {
    console.error("ml_accounts row not found or seller_id empty", accErr?.message);
    process.exit(1);
  }

  const sellerId = String(account.seller_id).trim();
  const token = await getValidAccessToken("", accountId);

  let itemIds: string[] = [];
  if (itemIdsArg) {
    itemIds = itemIdsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, limit);
  } else {
    const { data: rows } = await supabase
      .from("ml_catalog_items")
      .select("item_id, last_synced_at")
      .eq("ml_account_id", accountId)
      .order("last_synced_at", { ascending: false })
      .limit(limit);
    itemIds = (rows ?? []).map((r) => r.item_id).filter(Boolean);
  }

  if (itemIds.length === 0) {
    console.error("No item ids: set ITEM_IDS or sync catalog first.");
    process.exit(1);
  }

  console.info(
    JSON.stringify(
      { phase: "config", ml_account_id: accountId, seller_id: sellerId, item_count: itemIds.length },
      null,
      2
    )
  );

  const traces: ReturnType<typeof buildShippingDataTrace>[] = [];

  for (const itemId of itemIds) {
    const body = await mlFetch<Record<string, unknown>>(`/items/${encodeURIComponent(itemId)}`, {
      token,
      query: {
        attributes:
          "id,title,price,available_quantity,status,listing_type_id,category_id,condition,permalink,thumbnail,shipping,sale_terms,attributes,catalog_product_id"
      }
    });
    console.info(JSON.stringify({ phase: "raw_audit", item_id: itemId, payload: pickAuditPayload(body) }, null, 2));

    const parsed = parseMlCatalogApiItemBody(body);
    const { data: dbRow } = await supabase
      .from("ml_catalog_items")
      .select("*")
      .eq("ml_account_id", accountId)
      .eq("item_id", itemId)
      .maybeSingle();

    const trace = buildShippingDataTrace({
      itemId,
      rawBody: body,
      parsedCatalog: parsed,
      dbRow: dbRow ?? undefined,
      unified: null
    });
    traces.push(trace);
    console.info(JSON.stringify({ phase: "trace", trace, root_causes: classifyShippingTraceMismatch(trace) }, null, 2));
  }

  console.info(JSON.stringify({ phase: "summary", traces: traces.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
