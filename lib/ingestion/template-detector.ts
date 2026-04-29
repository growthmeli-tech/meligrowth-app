import type { TemplateType } from "@/lib/ingestion/types";

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Detects which template type a file is based on its column headers.
 * Runs client-side after SheetJS parses the first row.
 */
export function detectTemplateType(headers: string[]): TemplateType {
  const norm = headers.map((h) => normalizeHeader(String(h ?? "")));
  const set = new Set(norm.filter(Boolean));

  const has = (name: string) => set.has(name);

  // Pricing comercial: unique business columns
  if (has("plan") && has("current_revenue") && has("projected_revenue") && has("gross_margin_pct") && has("delivery_cost") && has("months")) {
    return "pricing_comercial";
  }

  // SKUs y stock
  if (has("sku") && has("producto") && has("stock")) {
    return "skus_stock";
  }

  // Márgenes: costo + producto, not a stock template
  if (has("producto") && has("costo") && !has("stock")) {
    return "margenes_costos";
  }

  // Ficha técnica
  if (has("sku") && has("titulo") && !has("stock")) {
    return "ficha_tecnica";
  }

  return "unknown";
}

export { normalizeHeader };
