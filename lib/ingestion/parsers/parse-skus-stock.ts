import type { ParseResult, SkusStockRow } from "@/lib/ingestion/types";

type RawRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Rows must be keyed by normalized column names (see template-detector / normalizeHeader).
 */
export function parseSkusStockRows(rows: RawRow[]): ParseResult<SkusStockRow> {
  const valid: SkusStockRow[] = [];
  const errors: ParseResult<SkusStockRow>["errors"] = [];
  const seenSkus = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const sku = str(row.sku);
    const producto = str(row.producto);
    const stockN = num(row.stock);
    const diasN = num(row.dias_stock);

    if (!sku) errors.push({ row: rowNum, field: "sku", message: "Requerido" });
    if (!producto) errors.push({ row: rowNum, field: "producto", message: "Requerido" });
    if (stockN === null) errors.push({ row: rowNum, field: "stock", message: "Debe ser numérico" });
    else if (stockN < 0) errors.push({ row: rowNum, field: "stock", message: "No puede ser negativo" });

    const rowErr = errors.filter((e) => e.row === rowNum);
    if (rowErr.length > 0) continue;

    if (sku && producto && stockN !== null && stockN >= 0) {
      const k = sku.toLowerCase();
      if (seenSkus.has(k)) {
        errors.push({ row: rowNum, field: "sku", message: `Duplicado (${sku})` });
        continue;
      }
      seenSkus.add(k);
      valid.push({ sku, producto, stock: stockN, dias_stock: diasN });
    }
  }
  return { valid, errors };
}
