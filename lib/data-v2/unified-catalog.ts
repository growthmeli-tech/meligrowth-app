import { calcSellingPrice } from "@/lib/pricing/calculator";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { listMlCatalogItems, updateCatalogItemPricingLink } from "@/lib/data-v2/ml-catalog-items";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];

function normSkuKey(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

export interface UnifiedCatalogItem {
  ml_row_id: string;
  item_id: string;
  title: string;
  price_ml: number | null;
  stock: number | null;
  sold_quantity: number | null;
  status: string;
  logistic_type: string | null;
  permalink: string | null;
  thumbnail: string | null;
  last_synced_at: string;
  seller_custom_field: string | null;

  pricing_sku_id: string | null;
  sku: string | null;
  costo: number | null;
  peso_kg: number | null;
  logistica: string | null;
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
}

function resolvePricingRow(
  ml: {
    pricing_sku_id: string | null;
    seller_custom_field: string | null;
    item_id: string;
  },
  byId: Map<string, PricingSkuRow>,
  bySkuKey: Map<string, PricingSkuRow>
): PricingSkuRow | null {
  if (ml.pricing_sku_id) {
    const row = byId.get(ml.pricing_sku_id);
    if (row) return row;
  }
  const k1 = normSkuKey(ml.seller_custom_field);
  if (k1 && bySkuKey.has(k1)) return bySkuKey.get(k1) ?? null;
  const k2 = normSkuKey(ml.item_id);
  if (k2 && bySkuKey.has(k2)) return bySkuKey.get(k2) ?? null;
  return null;
}

function buildPricingIndexes(rows: PricingSkuRow[]) {
  const byId = new Map<string, PricingSkuRow>();
  const bySkuKey = new Map<string, PricingSkuRow>();
  for (const r of rows) {
    byId.set(r.id, r);
    const k = normSkuKey(r.sku);
    if (k && !bySkuKey.has(k)) bySkuKey.set(k, r);
  }
  return { byId, bySkuKey };
}

function computeDerived(ml: {
  price: number | null;
  available_quantity: number | null;
  status: string | null;
  pricing_sku_id: string | null;
  seller_custom_field: string | null;
  item_id: string;
  sold_quantity: number | null;
}, pricing: PricingSkuRow | null): Omit<
  UnifiedCatalogItem,
  | "ml_row_id"
  | "item_id"
  | "title"
  | "permalink"
  | "thumbnail"
  | "last_synced_at"
  | "seller_custom_field"
  | "logistic_type"
  | "sold_quantity"
  | "status"
> & {
  price_ml: number | null;
  stock: number | null;
  sold_quantity: number | null;
  status: string;
} {
  const tiene_costo = Boolean(pricing);

  let precio_calculado: number | null = null;
  let ganancia_calculada: number | null = null;
  let roi_calculado: number | null = null;

  if (pricing) {
    const pub = pricing.publicidad_pct;
    const marg = pricing.margen_pct;
    const res = calcSellingPrice({
      costo: Number(pricing.costo),
      logistica: pricing.logistica,
      publicidad_pct: pub === null || pub === undefined ? 0 : Number(pub),
      margen_pct: marg === null || marg === undefined ? 0.15 : Number(marg)
    });
    if (res.converged && Number.isFinite(res.precio_venta)) {
      precio_calculado = res.precio_venta;
      ganancia_calculada = res.ganancia_unit;
      roi_calculado = res.roi;
    }
  }

  const price_ml = ml.price === null || ml.price === undefined ? null : Number(ml.price);
  let precio_desviado = false;
  if (price_ml !== null && precio_calculado !== null && precio_calculado > 0) {
    precio_desviado = Math.abs(price_ml - precio_calculado) / precio_calculado > 0.05;
  }

  const stock = ml.available_quantity === null || ml.available_quantity === undefined ? null : Number(ml.available_quantity);
  const stock_critico = stock !== null && stock < 10;

  const margen_pct = pricing?.margen_pct !== null && pricing?.margen_pct !== undefined ? Number(pricing.margen_pct) : null;
  const margen_en_riesgo = margen_pct !== null && margen_pct < 0.1;

  const sin_configurar = !tiene_costo;

  return {
    price_ml,
    stock,
    sold_quantity:
      ml.sold_quantity === null || ml.sold_quantity === undefined ? null : Number(ml.sold_quantity),
    status: ml.status ?? "—",
    precio_calculado,
    ganancia_calculada,
    roi_calculado,
    pricing_sku_id: pricing?.id ?? null,
    sku: pricing?.sku ?? null,
    costo: pricing ? Number(pricing.costo) : null,
    peso_kg: pricing?.peso_kg !== null && pricing?.peso_kg !== undefined ? Number(pricing.peso_kg) : null,
    logistica: pricing?.logistica ?? null,
    reputacion: pricing?.reputacion ?? null,
    publicidad_pct: pricing?.publicidad_pct !== null && pricing?.publicidad_pct !== undefined ? Number(pricing.publicidad_pct) : null,
    margen_pct,
    tiene_costo,
    precio_desviado,
    stock_critico,
    margen_en_riesgo,
    sin_configurar
  };
}

export async function listUnifiedCatalog(mlAccountId: string): Promise<ActionResult<UnifiedCatalogItem[]>> {
  const [catRes, priceRes] = await Promise.all([listMlCatalogItems(mlAccountId), listPricingSkus(mlAccountId)]);
  if (!catRes.success) return catRes;
  if (!priceRes.success) return priceRes;

  const { byId, bySkuKey } = buildPricingIndexes(priceRes.data);

  const unified: UnifiedCatalogItem[] = catRes.data.map((row) => {
    const pricing = resolvePricingRow(row, byId, bySkuKey);
    const derived = computeDerived(
      {
        price: row.price,
        available_quantity: row.available_quantity,
        status: row.status,
        pricing_sku_id: row.pricing_sku_id,
        seller_custom_field: row.seller_custom_field,
        item_id: row.item_id,
        sold_quantity: row.sold_quantity
      },
      pricing
    );

    return {
      ml_row_id: row.id,
      item_id: row.item_id,
      title: row.title,
      permalink: row.permalink,
      thumbnail: row.thumbnail,
      last_synced_at: row.last_synced_at,
      seller_custom_field: row.seller_custom_field,
      logistic_type: row.logistic_type,
      ...derived
    };
  });

  return { success: true, data: unified };
}

export async function linkPricingSkuToItem(
  mlAccountId: string,
  itemId: string,
  pricingSkuId: string
): Promise<ActionResult<void>> {
  return updateCatalogItemPricingLink(mlAccountId, itemId, pricingSkuId);
}

export type CatalogHealthSummary = {
  totalPublications: number;
  activePublications: number;
  sinStock: number;
  sinCosto: number;
  precioDesviado: number;
  bienConfigurados: number;
};

export async function getCatalogHealthSummary(mlAccountId: string): Promise<ActionResult<CatalogHealthSummary>> {
  const list = await listUnifiedCatalog(mlAccountId);
  if (!list.success) return list;

  const items = list.data;
  const totalPublications = items.length;
  const activePublications = items.filter((i) => i.status === "active").length;
  const sinStock = items.filter((i) => i.status === "active" && i.stock === 0).length;
  const sinCosto = items.filter((i) => !i.tiene_costo).length;
  const precioDesviado = items.filter((i) => i.precio_desviado).length;
  const bienConfigurados = items.filter(
    (i) => i.tiene_costo && !i.precio_desviado && !i.stock_critico && !i.margen_en_riesgo
  ).length;

  return {
    success: true,
    data: {
      totalPublications,
      activePublications,
      sinStock,
      sinCosto,
      precioDesviado,
      bienConfigurados
    }
  };
}

export type MlPublicationLink = {
  item_id: string;
  permalink: string | null;
  stock: number | null;
};

/** Maps pricing SKU rows to ML publication data for `/ops/pricing`. */
export function mapPricingSkusToMlLinks(pricingRows: PricingSkuRow[], unified: UnifiedCatalogItem[]): Map<string, MlPublicationLink> {
  const out = new Map<string, MlPublicationLink>();

  for (const p of pricingRows) {
    const direct = unified.find((u) => u.pricing_sku_id === p.id);
    const pk = normSkuKey(p.sku);
    const fuzzy =
      direct ??
      unified.find(
        (u) =>
          (pk !== null && normSkuKey(u.seller_custom_field) === pk) ||
          (pk !== null && normSkuKey(u.item_id) === pk)
      );
    if (fuzzy) {
      out.set(p.id, {
        item_id: fuzzy.item_id,
        permalink: fuzzy.permalink,
        stock: fuzzy.stock
      });
    }
  }

  return out;
}
