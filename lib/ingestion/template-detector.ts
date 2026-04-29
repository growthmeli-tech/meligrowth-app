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
 *
 * Uses minimum required columns per template (normalized). Order matters:
 * pricing → stock → ficha → márgenes (so overlapping headers resolve predictably).
 */
export function detectTemplateType(headers: string[]): TemplateType {
  const norm = headers.map((h) => normalizeHeader(String(h ?? "")));
  const set = new Set(norm.filter(Boolean));

  const has = (name: string) => set.has(name);

  // Plan 4 — pricing comercial (columns required by parser; setup_fee optional in data)
  if (
    has("plan") &&
    has("current_revenue") &&
    has("projected_revenue") &&
    has("gross_margin_pct") &&
    has("delivery_cost") &&
    has("months")
  ) {
    return "pricing_comercial";
  }

  // Plan 1 — SKUs y stock
  if (has("sku") && has("producto") && has("stock")) {
    return "skus_stock";
  }

  // Plan 3 — ficha técnica (titulo is distinctive; exclude sheets that are clearly stock)
  if (has("sku") && has("titulo") && !has("stock")) {
    return "ficha_tecnica";
  }

  // Plan 2 — márgenes / calculadora: costo + identificador (sku o producto)
  if (has("costo") && (has("sku") || has("producto"))) {
    return "margenes_costos";
  }

  return "unknown";
}

export { normalizeHeader };
