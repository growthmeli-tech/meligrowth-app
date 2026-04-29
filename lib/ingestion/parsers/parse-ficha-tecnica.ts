import type { Json } from "@/lib/supabase/database.types";
import type { ParseResult, FichaTecnicaRow } from "@/lib/ingestion/types";

type RawRow = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseAtributos(v: unknown): Json {
  if (v === null || v === undefined) return null;
  const s = str(v);
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as Json;
    } catch {
      // fall through to pipe
    }
  }
  if (trimmed.includes("|") || trimmed.includes(":")) {
    const obj: Record<string, string> = {};
    for (const part of trimmed.split("|")) {
      const p = part.trim();
      const idx = p.indexOf(":");
      if (idx === -1) continue;
      const k = p.slice(0, idx).trim();
      const val = p.slice(idx + 1).trim();
      if (k) obj[k] = val;
    }
    return Object.keys(obj).length ? (obj as Json) : null;
  }
  return s;
}

export function parseFichaTecnicaRows(
  rows: RawRow[],
  getCell: (row: RawRow, field: string) => unknown
): ParseResult<FichaTecnicaRow> {
  const valid: FichaTecnicaRow[] = [];
  const errors: ParseResult<FichaTecnicaRow>["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const sku = str(getCell(row, "sku"));
    const titulo = str(getCell(row, "titulo"));
    if (!sku) errors.push({ row: rowNum, field: "sku", message: "Requerido" });
    if (!titulo) errors.push({ row: rowNum, field: "titulo", message: "Requerido" });
    if (sku && titulo) {
      const d = getCell(row, "descripcion");
      const descripcion = d === null || d === undefined || str(d) === "" ? null : str(d);
      const attr = parseAtributos(getCell(row, "atributos"));
      valid.push({ sku, titulo, descripcion, atributos: attr });
    }
  }
  return { valid, errors };
}
