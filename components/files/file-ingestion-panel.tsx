"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importAndProcessClientFile } from "@/app/(internal)/internal/clients/[id]/files/actions";
import { detectTemplateType, normalizeHeader } from "@/lib/ingestion/template-detector";
import { parseFichaTecnicaRows } from "@/lib/ingestion/parsers/parse-ficha-tecnica";
import { parseMargenesCostosRows } from "@/lib/ingestion/parsers/parse-margenes-costos";
import { parsePricingComercialRows } from "@/lib/ingestion/parsers/parse-pricing-comercial";
import { parseSkusStockRows } from "@/lib/ingestion/parsers/parse-skus-stock";
import type { ParseErrorEntry, TemplateType } from "@/lib/ingestion/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_FILE_BYTES } from "@/lib/files/client-file-upload";
import { ChevronDown, ChevronRight, UploadCloud } from "lucide-react";

const LABELS: Record<TemplateType, string> = {
  skus_stock: "SKUs y Stock",
  margenes_costos: "Márgenes y Costos",
  ficha_tecnica: "Ficha Técnica",
  pricing_comercial: "Pricing Comercial",
  unknown: "Desconocido"
};

type LogRow = {
  id: string;
  filename: string;
  template_type: string;
  rows_valid: number | null;
  rows_error: number | null;
  status: string;
  processed_at: string | null;
  metrics_updated: unknown;
  alerts_generated: number | null;
};

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const isEscaped = inQuotes && line[index + 1] === '"';
      if (isEscaped) {
        current += '"';
        index += 1;
      } else inQuotes = !inQuotes;
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

function parseCsvToMatrix(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => splitCsvLine(line));
}

function matrixToObjects(matrix: string[][]): { headers: string[]; dataRows: Record<string, unknown>[] } {
  if (matrix.length < 2) return { headers: [], dataRows: [] };
  const rawH = matrix[0] ?? [];
  const norm = rawH.map((h) => normalizeHeader(h));
  const dataRows: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] ?? [];
    const row: Record<string, unknown> = {};
    for (let c = 0; c < norm.length; c += 1) {
      row[norm[c] || `col_${c}`] = line[c] ?? "";
    }
    dataRows.push(row);
  }
  return { headers: rawH.map((h) => normalizeHeader(h)), dataRows };
}

async function parseFileToObjects(file: File): Promise<{ headers: string[]; dataRows: Record<string, unknown>[] }> {
  const ext = file.name.toLowerCase();
  const ab = await file.arrayBuffer();
  if (ext.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(ab);
    const m = parseCsvToMatrix(text);
    return matrixToObjects(m);
  }
  const wb = XLSX.read(ab, { type: "array" });
  const sh = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]!] : null;
  if (!sh) return { headers: [], dataRows: [] };
  const m = XLSX.utils.sheet_to_json<string[]>(sh, { header: 1, defval: "" }) as string[][];
  if (!m.length) return { headers: [], dataRows: [] };
  return matrixToObjects(m as string[][]);
}

function getCell(row: Record<string, unknown>, field: string) {
  return row[field];
}

type Props = {
  companyId: string;
  mlAccountId: string;
  ingestionHistory: LogRow[];
};

export function FileIngestionPanel({ companyId, mlAccountId, ingestionHistory }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<Record<string, unknown>[]>([]);
  const [templateType, setTemplateType] = useState<TemplateType>("unknown");
  const [parseState, setParseState] = useState<{ valid: number; errors: ParseErrorEntry[]; rows: Record<string, unknown>[] } | null>(null);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onPick = useCallback(async (f: File | null) => {
    setIngestResult(null);
    setParseState(null);
    if (!f || f.size > MAX_FILE_BYTES) {
      setFile(null);
      if (f && f.size > MAX_FILE_BYTES) setIngestResult("El archivo supera 10 MB.");
      return;
    }
    setFile(f);
    try {
      const { headers: h, dataRows: dr } = await parseFileToObjects(f);
      setHeaders(h);
      setDataRows(dr);
      const t = detectTemplateType(h);
      setTemplateType(t);
      if (t === "unknown" || h.length === 0) {
        setParseState({ valid: 0, errors: [], rows: [] });
        if (h.length === 0) setIngestResult("No se pudieron leer encabezados.");
        return;
      }
      let res: { valid: unknown[]; errors: ParseErrorEntry[]; rows: Record<string, unknown>[] } = { valid: [], errors: [], rows: dr };
      if (t === "skus_stock") {
        const p = parseSkusStockRows(dr);
        res = { ...p, rows: dr };
      } else if (t === "margenes_costos") {
        res = { ...parseMargenesCostosRows(dr, getCell), rows: dr };
      } else if (t === "ficha_tecnica") {
        res = { ...parseFichaTecnicaRows(dr, getCell), rows: dr };
      } else {
        res = { ...parsePricingComercialRows(dr, getCell), rows: dr };
      }
      setParseState({ valid: res.valid.length, errors: res.errors, rows: res.rows });
    } catch (e) {
      setIngestResult(e instanceof Error ? e.message : "Error al leer el archivo");
      setFile(null);
    }
  }, []);

  const canImport = useMemo(
    () =>
      file &&
      templateType !== "unknown" &&
      parseState &&
      parseState.errors.length === 0 &&
      parseState.valid > 0,
    [file, templateType, parseState]
  );

  const runImport = useCallback(() => {
    if (!file || !parseState || !canImport) return;
    setIngestResult(null);
    const form = new FormData();
    form.set("file", file);
    form.set(
      "meta",
      JSON.stringify({
        mlAccountId,
        templateType,
        rows: dataRows
      })
    );
    startTransition(() => {
      void importAndProcessClientFile(companyId, form).then((r) => {
        if (r.success && r.data) {
          if (r.data.success) {
            setIngestResult(
              `Importado: ${r.data.rows_processed} filas. Alertas: ${r.data.alerts_generated}. ${
                Object.entries(r.data.metrics_updated)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ") || ""
              }`
            );
            setFile(null);
            setParseState(null);
            setHeaders([]);
            setDataRows([]);
            setTemplateType("unknown");
            return;
          }
          setIngestResult(r.data.errors[0] ?? "La importacion fallo");
        } else {
          setIngestResult(r.success === false ? r.error : "Error");
        }
      });
    });
  }, [file, parseState, canImport, companyId, mlAccountId, templateType, dataRows]);

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-brand-purple/50 p-4">
        <div className="flex flex-col gap-3">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-[#E8E8E2] bg-white p-4 text-center">
            <UploadCloud className="h-8 w-8 text-brand-purple" />
            <span className="mt-2 text-sm font-semibold text-zinc-900">Elegir archivo (CSV, XLSX, ODS)</span>
            <input
              className="mt-2 max-w-full text-xs"
              type="file"
              accept=".csv,.xlsx,.ods"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onPick(f);
                e.target.value = "";
              }}
            />
          </label>

          {file && (
            <div className="text-sm text-zinc-700">
              <p>
                <span className="font-semibold">Detectado:</span> {LABELS[templateType]}
              </p>
              {templateType === "unknown" && <p className="text-amber-800">Encabezados no reconocidos. Descargá la plantilla o corregí columnas.</p>}
            </div>
          )}

          {parseState && file ? (
            <div className="text-sm">
              {parseState.errors.length === 0 ? (
                <p className="font-semibold text-emerald-800">
                  {parseState.valid} filas válidas, 0 errores
                </p>
              ) : (
                <p className="font-semibold text-red-800">
                  0 importables, {parseState.errors.length} error(es) — no se puede importar hasta corregir el archivo
                </p>
              )}
            </div>
          ) : null}

          {parseState && parseState.errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded border border-red-200 bg-red-50/80 text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-red-900">
                    <th className="p-2">Fila</th>
                    <th className="p-2">Campo</th>
                    <th className="p-2">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {parseState.errors.map((e, i) => (
                    <tr key={i} className="border-t border-red-100 text-red-800">
                      <td className="p-2">{e.row}</td>
                      <td className="p-2">{e.field}</td>
                      <td className="p-2">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canImport && (
            <Button type="button" onClick={runImport} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Importando…" : `Importar ${parseState?.valid ?? 0} filas`}
            </Button>
          )}

          {ingestResult && <div className="rounded-lg border border-[#E8E8E2] bg-zinc-50 p-3 text-sm text-zinc-800">{ingestResult}</div>}
        </div>
      </Card>

      <section>
        <button
          type="button"
          className="mb-2 flex w-full items-center justify-between text-left text-sm font-bold text-zinc-900"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          Historial de importaciones
          {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {historyOpen && (
          <div className="overflow-x-auto rounded-xl border border-[#E8E8E2]">
            {ingestionHistory.length === 0 ? (
              <p className="p-4 text-sm text-zinc-600">Todavía no hay importaciones con pipeline.</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E2] bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                    <th className="p-2">Archivo</th>
                    <th className="p-2">Plantilla</th>
                    <th className="p-2">Válidas</th>
                    <th className="p-2">Errores</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Procesado</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {ingestionHistory.map((h) => (
                    <Fragment key={h.id}>
                      <tr className="border-b border-zinc-100">
                        <td className="p-2 font-mono text-xs">{h.filename}</td>
                        <td className="p-2">{h.template_type}</td>
                        <td className="p-2">{h.rows_valid ?? "—"}</td>
                        <td className="p-2">{h.rows_error ?? "—"}</td>
                        <td className="p-2">{h.status}</td>
                        <td className="p-2 text-xs text-zinc-600">
                          {h.processed_at ? new Date(h.processed_at).toLocaleString("es-AR") : "—"}
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="text-xs text-brand-dark underline"
                            onClick={() => setExpanded((x) => (x === h.id ? null : h.id))}
                          >
                            {expanded === h.id ? "Ocultar" : "Más"}
                          </button>
                        </td>
                      </tr>
                      {expanded === h.id && (
                        <tr className="border-b border-zinc-100 bg-zinc-50/80">
                          <td colSpan={7} className="p-3 text-xs text-zinc-700">
                            <div className="mb-1 font-semibold">Métricas</div>
                            <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(h.metrics_updated, null, 2)}</pre>
                            <div className="mt-2">Alertas generadas: {h.alerts_generated ?? 0}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
