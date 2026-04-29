import type { ParseErrorEntry, ParseResult, MargenesRow } from "@/lib/ingestion/types";

type RawRow = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * 0-1 or 0-100 → 0-1; empty → default
 */
function toUnitInterval(raw: unknown, defaultValue: number, field: string, rowNum: number): { value: number } | { error: ParseErrorEntry } {
  if (raw === null || raw === undefined || (typeof raw === "string" && str(raw) === "")) {
    return { value: defaultValue };
  }
  const n = num(raw);
  if (n === null) return { error: { row: rowNum, field, message: "Debe ser numérico" } };
  let v = n;
  if (v > 1) v = v / 100;
  if (v < 0 || v > 1) return { error: { row: rowNum, field, message: "Debe estar entre 0 y 1 (o 0–100)" } };
  return { value: v };
}

function parseLogistica(v: unknown): MargenesRow["logistica"] {
  const s = str(v).toLowerCase();
  if (!s) return "Flex";
  if (s.includes("full")) return "Full";
  if (s.includes("retiro")) return "Retiro domicilio";
  if (s.includes("flex")) return "Flex";
  return "Flex";
}

function parseReputacion(v: unknown): MargenesRow["reputacion"] {
  const s = str(v).toLowerCase();
  if (!s) return "Verde / MercadoLíder";
  if (s.includes("naranja") || s.includes("roja")) return "Naranja o Roja";
  return "Verde / MercadoLíder";
}

export function parseMargenesCostosRows(
  rows: RawRow[],
  getCell: (row: RawRow, field: string) => unknown
): ParseResult<MargenesRow> {
  const valid: MargenesRow[] = [];
  const errors: ParseResult<MargenesRow>["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const producto = str(getCell(row, "producto"));
    const costoN = num(getCell(row, "costo"));
    const sku = str(getCell(row, "sku")) || null;
    const pesoN = num(getCell(row, "peso_kg"));

    if (!producto) errors.push({ row: rowNum, field: "producto", message: "Requerido" });
    if (costoN === null || costoN <= 0) errors.push({ row: rowNum, field: "costo", message: "Requerido y > 0" });
    if (producto && costoN! > 0) {
      const pPub = toUnitInterval(getCell(row, "publicidad_pct"), 0, "publicidad_pct", rowNum);
      if ("error" in pPub) {
        errors.push(pPub.error);
        continue;
      }
      const pMar = toUnitInterval(getCell(row, "margen_pct"), 0.15, "margen_pct", rowNum);
      if ("error" in pMar) {
        errors.push(pMar.error);
        continue;
      }
      valid.push({
        sku,
        producto,
        costo: costoN!,
        peso_kg: pesoN,
        logistica: parseLogistica(getCell(row, "logistica")),
        reputacion: parseReputacion(getCell(row, "reputacion")),
        publicidad_pct: pPub.value,
        margen_pct: pMar.value
      });
    }
  }

  return { valid, errors };
}
