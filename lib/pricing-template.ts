import ExcelJS from "exceljs";
import { normalizePricingPlan } from "@/lib/pricing";
import type { PricingInput } from "@/lib/pricing";

const HEADER_ALIASES = {
  plan: ["plan", "plan_contratado"],
  currentRevenue: ["current_revenue", "facturacion_actual", "facturacion_actual_mensual", "facturacion_actual_ars"],
  projectedRevenue: ["projected_revenue", "facturacion_proyectada", "facturacion_proyectada_mensual", "facturacion_proyectada_ars"],
  grossMarginPct: ["gross_margin_pct", "margen_bruto_pct", "margen_bruto", "margen_cliente_pct"],
  deliveryCost: ["delivery_cost", "costo_operativo", "costo_operativo_mg", "costo_operativo_meligrowth"],
  setupFee: ["setup_fee", "setup_inicial", "fee_setup", "onboarding_fee"],
  months: ["months", "meses", "meses_contrato"]
} satisfies Record<keyof PricingInput, string[]>;

const REQUIRED_KEYS: Array<keyof PricingInput> = ["plan", "currentRevenue", "projectedRevenue", "grossMarginPct", "deliveryCost", "setupFee", "months"];

type RowValues = Record<string, string>;

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const isEscapedQuote = inQuotes && line[index + 1] === '"';
      if (isEscapedQuote) {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string): RowValues {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("La plantilla debe incluir encabezados y al menos una fila de datos.");
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const firstDataRow = splitCsvLine(lines[1]);

  return Object.fromEntries(headers.map((header, index) => [header, firstDataRow[index] ?? ""]));
}

async function parseXlsx(buffer: ArrayBuffer): Promise<RowValues> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("No encontramos hojas en el archivo.");
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values : [];
  const headers = headerValues
    .slice(1)
    .map((value) => normalizeHeader(String(value ?? "")));

  let firstDataRowValues: string[] | null = null;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || firstDataRowValues) return;
    const rowValues = Array.isArray(row.values) ? row.values : [];
    const values = rowValues.slice(1).map((value) => String(value ?? "").trim());
    if (values.some(Boolean)) {
      firstDataRowValues = values;
    }
  });

  if (!firstDataRowValues) {
    throw new Error("La plantilla no tiene una fila con datos.");
  }

  return Object.fromEntries(headers.map((header, index) => [header, firstDataRowValues?.[index] ?? ""]));
}

function parseNumeric(value: string, fallback = 0) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFieldValue(row: RowValues, field: keyof PricingInput) {
  const aliases = HEADER_ALIASES[field];
  return aliases.map((alias) => row[alias]).find(Boolean) ?? "";
}

function buildPricingInput(row: RowValues): PricingInput {
  const missing = REQUIRED_KEYS.filter((field) => !getFieldValue(row, field));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas o valores requeridos: ${missing.join(", ")}`);
  }

  return {
    plan: normalizePricingPlan(getFieldValue(row, "plan")),
    currentRevenue: parseNumeric(getFieldValue(row, "currentRevenue"), 0),
    projectedRevenue: parseNumeric(getFieldValue(row, "projectedRevenue"), 0),
    grossMarginPct: parseNumeric(getFieldValue(row, "grossMarginPct"), 0),
    deliveryCost: parseNumeric(getFieldValue(row, "deliveryCost"), 0),
    setupFee: parseNumeric(getFieldValue(row, "setupFee"), 0),
    months: Math.max(1, Math.round(parseNumeric(getFieldValue(row, "months"), 6)))
  };
}

export async function parsePricingTemplateSource({
  filename,
  text,
  arrayBuffer
}: {
  filename: string;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<PricingInput> {
  const normalizedFilename = filename.toLowerCase();

  if (normalizedFilename.endsWith(".csv")) {
    return buildPricingInput(parseCsv(await text()));
  }

  if (normalizedFilename.endsWith(".xlsx")) {
    return buildPricingInput(await parseXlsx(await arrayBuffer()));
  }

  throw new Error("Formato no soportado. Usá la plantilla CSV o XLSX.");
}

export async function parsePricingTemplate(file: File): Promise<PricingInput> {
  return parsePricingTemplateSource({
    filename: file.name,
    text: () => file.text(),
    arrayBuffer: () => file.arrayBuffer()
  });
}
