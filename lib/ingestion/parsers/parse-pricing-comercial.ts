import type { ParseResult, PricingComercialRow } from "@/lib/ingestion/types";

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

function int(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function toMarginPct(v: number | null): { ok: true; value: number } | { ok: false; message: string } {
  if (v === null) return { ok: false, message: "Requerido" };
  let g = v;
  if (g > 1) g = g / 100;
  if (g < 0 || g > 1) return { ok: false, message: "0–1 o 0–100" };
  return { ok: true, value: g };
}

export function parsePricingComercialRows(
  rows: RawRow[],
  getCell: (row: RawRow, field: string) => unknown
): ParseResult<PricingComercialRow> {
  const valid: PricingComercialRow[] = [];
  const errors: ParseResult<PricingComercialRow>["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const plan = str(getCell(row, "plan"));
    const current = num(getCell(row, "current_revenue"));
    const proj = num(getCell(row, "projected_revenue"));
    const grossN = num(getCell(row, "gross_margin_pct"));
    const delivery = num(getCell(row, "delivery_cost"));
    const setup = num(getCell(row, "setup_fee"));
    const monthsN = int(getCell(row, "months"));

    if (!plan) errors.push({ row: rowNum, field: "plan", message: "Requerido" });
    if (current === null) errors.push({ row: rowNum, field: "current_revenue", message: "Numérico requerido" });
    if (proj === null) errors.push({ row: rowNum, field: "projected_revenue", message: "Numérico requerido" });
    const m = toMarginPct(grossN);
    if (m.ok === false) errors.push({ row: rowNum, field: "gross_margin_pct", message: m.message });
    if (delivery === null) errors.push({ row: rowNum, field: "delivery_cost", message: "Numérico requerido" });
    if (monthsN === null || monthsN <= 0) errors.push({ row: rowNum, field: "months", message: "Entero > 0" });
    const setupF = getCell(row, "setup_fee");
    const setupV = setupF === null || str(setupF) === "" ? 0 : num(setupF);
    if (setupF !== null && str(setupF) !== "" && (setupV === null || setupV! < 0)) {
      errors.push({ row: rowNum, field: "setup_fee", message: "Debe ser >= 0" });
    }

    if (plan && current !== null && proj !== null && m.ok && delivery !== null && monthsN! > 0) {
      const gm = m as { ok: true; value: number };
      valid.push({
        plan,
        current_revenue: current!,
        projected_revenue: proj!,
        gross_margin_pct: gm.value,
        delivery_cost: delivery!,
        setup_fee: setupV ?? 0,
        months: monthsN!
      });
    }
  }
  return { valid, errors };
}
