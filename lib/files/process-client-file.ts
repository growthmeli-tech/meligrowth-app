import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

type FileType = Database["public"]["Tables"]["client_files"]["Row"]["tipo"];

type ParserResult = {
  tipo: FileType | "otro";
  rows: number;
  columns: string[];
  data: Array<Record<string, unknown>>;
  errors: string[];
};

type ProcessResult =
  | { ok: true; rows: number; tipo: FileType; columns: string[] }
  | { ok: false; error: string };

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getParserConfig() {
  const parserUrl = process.env.PARSER_SERVICE_URL;
  const parserSecret = process.env.PARSER_SERVICE_SECRET;

  if (!parserUrl || !parserSecret) {
    throw new Error("Missing PARSER_SERVICE_URL or PARSER_SERVICE_SECRET");
  }

  return {
    parserUrl: parserUrl.replace(/\/$/, ""),
    parserSecret
  };
}

function asFileType(value: string): FileType {
  if (value === "skus_stock" || value === "margenes" || value === "ficha_tecnica") return value;
  return "otro";
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asJsonObject(value: unknown): { [key: string]: Json | undefined } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (entry === null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        return [key, entry];
      }
      return [key, String(entry)];
    })
  );
}

async function persistParsedRows({
  clientId,
  fileId,
  tipo,
  rows
}: {
  clientId: string;
  fileId: string;
  tipo: FileType;
  rows: Array<Record<string, unknown>>;
}) {
  const supabase = await createServerSupabaseClient();

  if (tipo === "skus_stock") {
    const payload = rows
      .map((row) => ({
        client_id: clientId,
        sku: asString(row.sku),
        stock: asNumber(row.stock),
        last_file_id: fileId
      }))
      .filter((row): row is { client_id: string; sku: string; stock: number | null; last_file_id: string } => Boolean(row.sku));

    if (payload.length === 0) return { ok: true as const };
    const { error } = await supabase.from("products").upsert(payload, { onConflict: "client_id,sku" });
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  }

  if (tipo === "margenes") {
    const payload = rows
      .map((row) => ({
        client_id: clientId,
        sku: asString(row.sku),
        costo: asNumber(row.costo),
        precio: asNumber(row.precio),
        margen: asNumber(row.margen),
        last_file_id: fileId
      }))
      .filter((row): row is { client_id: string; sku: string; costo: number | null; precio: number | null; margen: number | null; last_file_id: string } => Boolean(row.sku));

    if (payload.length === 0) return { ok: true as const };
    const { error } = await supabase.from("margins").upsert(payload, { onConflict: "client_id,sku" });
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  }

  if (tipo === "ficha_tecnica") {
    const payload = rows
      .map((row) => ({
        client_id: clientId,
        sku: asString(row.sku),
        titulo: asString(row.titulo),
        descripcion: asString(row.descripcion),
        attributes: asJsonObject(row.attributes),
        last_file_id: fileId
      }))
      .filter((row): row is { client_id: string; sku: string; titulo: string | null; descripcion: string | null; attributes: { [key: string]: Json | undefined }; last_file_id: string } => Boolean(row.sku));

    if (payload.length === 0) return { ok: true as const };
    const { error: specsError } = await supabase.from("product_specs").upsert(payload, { onConflict: "client_id,sku" });
    if (specsError) return { ok: false as const, error: specsError.message };

    const productPayload = payload.map((row) => ({
      client_id: clientId,
      sku: row.sku,
      title: row.titulo,
      description: row.descripcion,
      last_file_id: fileId
    }));
    const { error: productsError } = await supabase.from("products").upsert(productPayload, { onConflict: "client_id,sku" });
    return productsError ? { ok: false as const, error: productsError.message } : { ok: true as const };
  }

  return { ok: true as const };
}

async function notifyOperator({
  clientId,
  operatorId,
  title,
  message
}: {
  clientId: string;
  operatorId: string | null;
  title: string;
  message: string;
}) {
  if (!operatorId) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("notifications").insert({
    client_id: clientId,
    user_id: operatorId,
    tipo: "archivo_procesado",
    titulo: title,
    mensaje: message,
    leida: false
  });
}

export async function processClientFile(fileId: string): Promise<ProcessResult> {
  const supabase = await createServerSupabaseClient();
  const { parserUrl, parserSecret } = getParserConfig();

  const { data: fileRow, error: fileError } = await supabase.from("client_files").select("*").eq("id", fileId).single();
  if (fileError || !fileRow) {
    return { ok: false, error: "Archivo no encontrado" };
  }

  const { data: clientRow } = await supabase.from("clients").select("operator_id").eq("id", fileRow.client_id).single();

  const { data: blob, error: downloadError } = await supabase.storage.from("client-files").download(fileRow.storage_path);
  if (downloadError || !blob) {
    const message = "No se pudo descargar el archivo desde Storage";
    await supabase.from("client_files").update({ procesado: false, error_procesamiento: message }).eq("id", fileId);
    await notifyOperator({
      clientId: fileRow.client_id,
      operatorId: clientRow?.operator_id ?? null,
      title: "Error procesando archivo",
      message: `${fileRow.filename}: ${message}`
    });
    return { ok: false, error: message };
  }

  const formData = new FormData();
  formData.append("file", blob, fileRow.filename);

  try {
    const response = await fetchWithTimeout(`${parserUrl}/parse`, {
      method: "POST",
      headers: {
        "x-parser-secret": parserSecret
      },
      body: formData
    });

    if (!response.ok) {
      const message = `Parser respondió ${response.status}`;
      await supabase.from("client_files").update({ procesado: false, error_procesamiento: message }).eq("id", fileId);
      await notifyOperator({
        clientId: fileRow.client_id,
        operatorId: clientRow?.operator_id ?? null,
        title: "Error procesando archivo",
        message: `${fileRow.filename}: ${message}`
      });
      return { ok: false, error: message };
    }

    const result = (await response.json()) as ParserResult;
    const errors = result.errors ?? [];

    if (errors.length > 0 || result.tipo === "otro") {
      const message = errors.length > 0 ? errors.join(" | ") : "No se pudo detectar el tipo de plantilla";
      await supabase
        .from("client_files")
        .update({
          tipo: asFileType(result.tipo),
          procesado: false,
          error_procesamiento: message
        })
        .eq("id", fileId);
      await notifyOperator({
        clientId: fileRow.client_id,
        operatorId: clientRow?.operator_id ?? null,
        title: "Archivo con errores",
        message: `${fileRow.filename}: ${message}`
      });
      return { ok: false, error: message };
    }

    const tipo = asFileType(result.tipo);
    const persisted = await persistParsedRows({
      clientId: fileRow.client_id,
      fileId,
      tipo,
      rows: result.data ?? []
    });

    if (!persisted.ok) {
      const message = `No se pudieron guardar los datos normalizados: ${persisted.error}`;
      await supabase.from("client_files").update({ procesado: false, error_procesamiento: message }).eq("id", fileId);
      await notifyOperator({
        clientId: fileRow.client_id,
        operatorId: clientRow?.operator_id ?? null,
        title: "Error normalizando archivo",
        message: `${fileRow.filename}: ${message}`
      });
      return { ok: false, error: message };
    }

    await supabase
      .from("client_files")
      .update({
        tipo,
        procesado: true,
        procesado_at: new Date().toISOString(),
        error_procesamiento: null
      })
      .eq("id", fileId);

    await notifyOperator({
      clientId: fileRow.client_id,
      operatorId: clientRow?.operator_id ?? null,
      title: "Archivo procesado",
      message: `${fileRow.filename}: ${result.rows} filas importadas como ${tipo}.`
    });

    return { ok: true, rows: result.rows, tipo, columns: result.columns };
  } catch {
    const message = "No se pudo conectar con el parser";
    await supabase.from("client_files").update({ procesado: false, error_procesamiento: message }).eq("id", fileId);
    await notifyOperator({
      clientId: fileRow.client_id,
      operatorId: clientRow?.operator_id ?? null,
      title: "Error procesando archivo",
      message: `${fileRow.filename}: ${message}`
    });
    return { ok: false, error: message };
  }
}
