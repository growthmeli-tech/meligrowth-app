import {
  calcRealProfit,
  calcSellingPrice,
  calcStockStatus,
  coerceReputacion,
  normalizePct,
  type LogisticaType,
  type ReputacionType
} from "@/lib/pricing/calculator";
import { listPricingSkus, type NormalizedPricingSkuRow } from "@/lib/data-v2/pricing-skus";
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
  /** Ventas últimos 30 días cuando la ingesta ML lo provea; hoy suele ser null (ver changelog). */
  ventas_30d: number | null;
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

  ganancia_real: number | null;
  margen_real_pct: number | null;
  comision_real: number | null;
  envio_real: number | null;
  publicidad_real: number | null;

  stock_status: "critico" | "reponer" | "saludable" | "exceso" | null;
  units_to_buy: number | null;
  days_remaining: number | null;
  stock_urgency: "urgente" | "pronto" | "ok" | null;

  precio_vs_objetivo: "sobre" | "bajo" | "ok" | null;
  desviacion_precio_pct: number | null;
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

function buildPricingIndexes(rows: NormalizedPricingSkuRow[]) {
  const byId = new Map<string, PricingSkuRow>();
  const bySkuKey = new Map<string, PricingSkuRow>();
  for (const r of rows) {
    byId.set(r.id, r);
    const k = normSkuKey(r.sku);
    if (k && !bySkuKey.has(k)) bySkuKey.set(k, r);
  }
  return { byId, bySkuKey };
}

type MlSlice = {
  price: number | null;
  available_quantity: number | null;
  status: string | null;
  pricing_sku_id: string | null;
  seller_custom_field: string | null;
  item_id: string;
  sold_quantity: number | null;
  ventas_30d: number | null;
};

/**
 * Expone la derivación pura para tests y para `listUnifiedCatalog`.
 */
export function computeUnifiedCatalogDerived(
  ml: MlSlice,
  pricing: PricingSkuRow | null
): Omit<
  UnifiedCatalogItem,
  | "ml_row_id"
  | "item_id"
  | "title"
  | "permalink"
  | "thumbnail"
  | "last_synced_at"
  | "seller_custom_field"
  | "logistic_type"
  | "status"
> & { price_ml: number | null; stock: number | null; sold_quantity: number | null; status: string } {
  const tiene_costo = Boolean(pricing);

  const pubNorm = pricing ? normalizePct(pricing.publicidad_pct) : 0;
  const margNorm = pricing ? normalizePct(pricing.margen_pct ?? 0.15) || 0.15 : 0.15;
  const reputacionResolved: ReputacionType = pricing ? coerceReputacion(pricing.reputacion) : "Verde / MercadoLíder";
  const logisticaPricing = (pricing?.logistica ?? "Flex") as LogisticaType;

  let precio_calculado: number | null = null;
  let ganancia_calculada: number | null = null;
  let roi_calculado: number | null = null;

  if (pricing) {
    const res = calcSellingPrice({
      costo: Number(pricing.costo),
      logistica: logisticaPricing,
      publicidad_pct: pubNorm,
      margen_pct: margNorm,
      reputacion: reputacionResolved
    });
    if (res.converged && Number.isFinite(res.precio_venta)) {
      precio_calculado = res.precio_venta;
      ganancia_calculada = res.ganancia_unit;
      roi_calculado = res.roi;
    }
  }

  const price_ml = ml.price === null || ml.price === undefined ? null : Number(ml.price);

  let precio_vs_objetivo: "sobre" | "bajo" | "ok" | null = null;
  let desviacion_precio_pct: number | null = null;
  let precio_desviado = false;
  if (price_ml !== null && precio_calculado !== null && precio_calculado > 0) {
    desviacion_precio_pct = Math.round(((price_ml - precio_calculado) / precio_calculado) * 10_000) / 100;
    precio_desviado = Math.abs(price_ml - precio_calculado) / precio_calculado > 0.05;
    const tol = 0.02;
    if (price_ml < precio_calculado * (1 - tol)) precio_vs_objetivo = "bajo";
    else if (price_ml > precio_calculado * (1 + tol)) precio_vs_objetivo = "sobre";
    else precio_vs_objetivo = "ok";
  }

  const stock = ml.available_quantity === null || ml.available_quantity === undefined ? null : Number(ml.available_quantity);
  const ventas_30d =
    ml.ventas_30d === null || ml.ventas_30d === undefined || Number.isNaN(Number(ml.ventas_30d))
      ? null
      : Number(ml.ventas_30d);

  const stockInfo =
    stock === null
      ? null
      : calcStockStatus({
          stock_actual: stock,
          ventas_30d,
          safety_pct: 0.2
        });

  let ganancia_real: number | null = null;
  let margen_real_pct: number | null = null;
  let comision_real: number | null = null;
  let envio_real: number | null = null;
  let publicidad_real: number | null = null;

  if (pricing && price_ml !== null && Number(pricing.costo) > 0) {
    const rp = calcRealProfit({
      price_ml,
      costo: Number(pricing.costo),
      logistica: logisticaPricing,
      reputacion: reputacionResolved,
      publicidad_pct: pubNorm,
      peso_kg: pricing.peso_kg !== null && pricing.peso_kg !== undefined ? Number(pricing.peso_kg) : null
    });
    if (rp.converged && Number.isFinite(rp.ganancia_real)) {
      ganancia_real = rp.ganancia_real;
      margen_real_pct = rp.margen_real;
      comision_real = rp.comision_$;
      envio_real = rp.envio_$;
      publicidad_real = rp.publicidad_$;
    }
  }

  const margen_pct_out = pricing?.margen_pct !== null && pricing?.margen_pct !== undefined ? normalizePct(pricing.margen_pct) : null;

  const margen_en_riesgo =
    margen_real_pct !== null && margen_real_pct >= 0 && margen_real_pct < 0.1 && tiene_costo && price_ml !== null;

  const stock_critico = stockInfo?.status === "critico";

  const sin_configurar = !tiene_costo;

  return {
    price_ml,
    stock,
    sold_quantity: ml.sold_quantity === null || ml.sold_quantity === undefined ? null : Number(ml.sold_quantity),
    status: ml.status ?? "—",
    ventas_30d,
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
    margen_pct: margen_pct_out,
    tiene_costo,
    precio_desviado,
    stock_critico,
    margen_en_riesgo,
    sin_configurar,
    ganancia_real,
    margen_real_pct,
    comision_real,
    envio_real,
    publicidad_real,
    stock_status: stockInfo?.status ?? null,
    units_to_buy: stockInfo === null ? null : stockInfo.units_to_buy,
    days_remaining: stockInfo === null ? null : stockInfo.days_remaining,
    stock_urgency: stockInfo === null ? null : stockInfo.urgency,
    precio_vs_objetivo,
    desviacion_precio_pct
  };
}

export async function listUnifiedCatalog(mlAccountId: string): Promise<ActionResult<UnifiedCatalogItem[]>> {
  const [catRes, priceRes] = await Promise.all([listMlCatalogItems(mlAccountId), listPricingSkus(mlAccountId)]);
  if (!catRes.success) return catRes;
  if (!priceRes.success) return priceRes;

  const { byId, bySkuKey } = buildPricingIndexes(priceRes.data);

  const unified: UnifiedCatalogItem[] = catRes.data.map((row) => {
    const pricing = resolvePricingRow(row, byId, bySkuKey);
    const derived = computeUnifiedCatalogDerived(
      {
        price: row.price,
        available_quantity: row.available_quantity,
        status: row.status,
        pricing_sku_id: row.pricing_sku_id,
        seller_custom_field: row.seller_custom_field,
        item_id: row.item_id,
        sold_quantity: row.sold_quantity,
        ventas_30d:
          row.ventas_30d === null || row.ventas_30d === undefined ? null : Number(row.ventas_30d)
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
  price_ml: number | null;
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
        stock: fuzzy.stock,
        price_ml: fuzzy.price_ml
      });
    }
  }

  return out;
}
