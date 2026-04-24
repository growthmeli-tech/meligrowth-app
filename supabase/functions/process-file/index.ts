import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ParserResult = {
  tipo: "skus_stock" | "margenes" | "ficha_tecnica" | "otro";
  rows: number;
  columns: string[];
  data: Array<Record<string, unknown>>;
  errors: string[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

serve(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { file_id: fileId } = await req.json().catch(() => ({ file_id: null }));
  if (!fileId) {
    return json({ ok: false, error: "Missing file_id" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const parserUrl = Deno.env.get("PARSER_SERVICE_URL")?.replace(/\/$/, "");
  const parserSecret = Deno.env.get("PARSER_SERVICE_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !parserUrl || !parserSecret) {
    return json({ ok: false, error: "Missing internal configuration" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: fileRow, error: fileError } = await supabase.from("client_files").select("*").eq("id", fileId).single();
  if (fileError || !fileRow) {
    return json({ ok: false, error: "File not found" }, 404);
  }

  const { data: clientRow } = await supabase.from("clients").select("operator_id").eq("id", fileRow.client_id).single();
  const { data: blob, error: downloadError } = await supabase.storage.from("client-files").download(fileRow.storage_path);

  if (downloadError || !blob) {
    const message = "No se pudo descargar el archivo desde Storage";
    await markError(supabase, fileRow, clientRow?.operator_id, message);
    return json({ ok: false, error: message }, 500);
  }

  const formData = new FormData();
  formData.append("file", blob, fileRow.filename);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const response = await fetch(`${parserUrl}/parse`, {
      method: "POST",
      headers: { "x-parser-secret": parserSecret },
      body: formData,
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const message = `Parser respondió ${response.status}`;
      await markError(supabase, fileRow, clientRow?.operator_id, message);
      return json({ ok: false, error: message }, 502);
    }

    const result = (await response.json()) as ParserResult;
    if (result.tipo === "otro" || result.errors.length > 0) {
      const message = result.errors.length > 0 ? result.errors.join(" | ") : "No se pudo detectar el tipo de plantilla";
      await markError(supabase, fileRow, clientRow?.operator_id, message, result.tipo);
      return json({ ok: false, error: message }, 422);
    }

    const persisted = await persistParsedRows(supabase, fileRow.client_id, fileId, result.tipo, result.data ?? []);
    if (!persisted.ok) {
      const message = `No se pudieron guardar los datos normalizados: ${persisted.error}`;
      await markError(supabase, fileRow, clientRow?.operator_id, message, result.tipo);
      return json({ ok: false, error: message }, 500);
    }

    await supabase
      .from("client_files")
      .update({
        tipo: result.tipo,
        procesado: true,
        procesado_at: new Date().toISOString(),
        error_procesamiento: null
      })
      .eq("id", fileId);

    await notify(supabase, fileRow.client_id, clientRow?.operator_id, "Archivo procesado", `${fileRow.filename}: ${result.rows} filas importadas como ${result.tipo}.`);

    return json({ ok: true, rows: result.rows, tipo: result.tipo, columns: result.columns });
  } catch {
    const message = "No se pudo conectar con el parser";
    await markError(supabase, fileRow, clientRow?.operator_id, message);
    return json({ ok: false, error: message }, 502);
  }
});

function asString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function persistParsedRows(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  fileId: string,
  tipo: "skus_stock" | "margenes" | "ficha_tecnica",
  rows: Array<Record<string, unknown>>
) {
  if (tipo === "skus_stock") {
    const payload = rows
      .map((row) => ({
        client_id: clientId,
        sku: asString(row.sku),
        stock: asNumber(row.stock),
        last_file_id: fileId
      }))
      .filter((row) => Boolean(row.sku));
    if (payload.length === 0) return { ok: true };
    const { error } = await supabase.from("products").upsert(payload, { onConflict: "client_id,sku" });
    return error ? { ok: false, error: error.message } : { ok: true };
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
      .filter((row) => Boolean(row.sku));
    if (payload.length === 0) return { ok: true };
    const { error } = await supabase.from("margins").upsert(payload, { onConflict: "client_id,sku" });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const specsPayload = rows
    .map((row) => ({
      client_id: clientId,
      sku: asString(row.sku),
      titulo: asString(row.titulo),
      descripcion: asString(row.descripcion),
      attributes: row.attributes && typeof row.attributes === "object" ? row.attributes : {},
      last_file_id: fileId
    }))
    .filter((row) => Boolean(row.sku));
  if (specsPayload.length === 0) return { ok: true };

  const { error: specsError } = await supabase.from("product_specs").upsert(specsPayload, { onConflict: "client_id,sku" });
  if (specsError) return { ok: false, error: specsError.message };

  const productPayload = specsPayload.map((row) => ({
    client_id: clientId,
    sku: row.sku,
    title: row.titulo,
    description: row.descripcion,
    last_file_id: fileId
  }));
  const { error: productsError } = await supabase.from("products").upsert(productPayload, { onConflict: "client_id,sku" });
  return productsError ? { ok: false, error: productsError.message } : { ok: true };
}

async function markError(
  supabase: ReturnType<typeof createClient>,
  fileRow: { id: string; client_id: string; filename: string },
  operatorId: string | null | undefined,
  message: string,
  tipo = "otro"
) {
  await supabase
    .from("client_files")
    .update({
      tipo,
      procesado: false,
      error_procesamiento: message
    })
    .eq("id", fileRow.id);

  await notify(supabase, fileRow.client_id, operatorId, "Error procesando archivo", `${fileRow.filename}: ${message}`);
}

async function notify(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  operatorId: string | null | undefined,
  title: string,
  message: string
) {
  if (!operatorId) return;
  await supabase.from("notifications").insert({
    client_id: clientId,
    user_id: operatorId,
    tipo: "archivo_procesado",
    titulo: title,
    mensaje: message,
    leida: false
  });
}
