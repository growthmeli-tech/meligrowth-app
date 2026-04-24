import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ClientRow = {
  id: string;
  name: string;
  client_user_id: string | null;
  operator_id: string | null;
};

type DiagnosticRow = {
  date: string;
  score_global: number;
  estado_global: string;
  score_salud: number | null;
  score_publicaciones: number | null;
  score_ads: number | null;
  score_logistica: number | null;
  score_stock: number | null;
};

type ActionRow = {
  titulo: string;
  descripcion: string | null;
  prioridad: "urgente" | "alta" | "media";
  estado: "pendiente" | "en_curso" | "completada";
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REPORT_FROM_EMAIL") ?? "MeliGrowth <reports@meligrowth.com>";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, client_user_id, operator_id")
    .eq("active", true)
    .not("client_user_id", "is", null);

  if (error) return json({ ok: false, error: error.message }, 500);

  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const client of (clients ?? []) as ClientRow[]) {
    const report = await buildReport(supabase, client);
    if (!report) {
      result.skipped += 1;
      continue;
    }

    const reportInsert = await supabase
      .from("weekly_reports")
      .insert({
        client_id: client.id,
        user_id: client.client_user_id,
        email: report.email,
        score_global: report.current.score_global,
        score_delta: report.delta,
        status: "pending"
      })
      .select("id")
      .single();

    const reportId = reportInsert.data?.id;
    const sendResult = await sendEmail({
      apiKey: resendApiKey,
      from,
      to: report.email,
      subject: `Resumen semanal MeliGrowth - ${client.name}`,
      html: report.html,
      pdfBase64: report.pdfBase64,
      filename: `meligrowth-${slug(client.name)}-${new Date().toISOString().slice(0, 10)}.pdf`
    });

    if (sendResult.ok) {
      result.sent += 1;
      if (reportId) {
        await supabase
          .from("weekly_reports")
          .update({ status: "sent", resend_email_id: sendResult.id, sent_at: new Date().toISOString() })
          .eq("id", reportId);
      }
      if (client.client_user_id) {
        await supabase.from("notifications").insert({
          client_id: client.id,
          user_id: client.client_user_id,
          tipo: "reporte_semanal",
          titulo: "Reporte semanal enviado",
          mensaje: `Te enviamos por email el resumen semanal de ${client.name}.`,
          leida: false
        });
      }
    } else {
      result.failed += 1;
      if (reportId) {
        await supabase.from("weekly_reports").update({ status: "error", error_msg: sendResult.error }).eq("id", reportId);
      }
    }
  }

  return json({ ok: true, ...result });
});

async function buildReport(supabase: ReturnType<typeof createClient>, client: ClientRow) {
  if (!client.client_user_id) return null;

  const [{ data: user }, { data: diagnostics }, { data: actions }] = await Promise.all([
    supabase.from("users").select("email, name").eq("id", client.client_user_id).single(),
    supabase
      .from("diagnostics")
      .select("date, score_global, estado_global, score_salud, score_publicaciones, score_ads, score_logistica, score_stock")
      .eq("client_id", client.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("actions")
      .select("titulo, descripcion, prioridad, estado")
      .eq("client_id", client.id)
      .neq("estado", "completada")
      .order("prioridad", { ascending: true })
      .limit(6)
  ]);

  const [current, previous] = (diagnostics ?? []) as DiagnosticRow[];
  if (!user?.email || !current) return null;

  const topActions = selectTopActions((actions ?? []) as ActionRow[]);
  const delta = previous ? Number(current.score_global) - Number(previous.score_global) : null;
  const html = renderHtml({
    clientName: client.name,
    recipientName: user.name ?? client.name,
    current,
    previous,
    delta,
    topActions
  });
  const pdfBase64 = toBase64(
    generatePdf([
      "MeliGrowth - Resumen semanal",
      client.name,
      `Score actual: ${current.score_global}`,
      `Variación semanal: ${formatDelta(delta)}`,
      `Estado: ${current.estado_global}`,
      "Acciones principales:",
      ...topActions.map((action, index) => `${index + 1}. ${action.titulo}`)
    ])
  );

  return {
    email: user.email as string,
    current,
    previous,
    delta,
    html,
    pdfBase64
  };
}

function selectTopActions(actions: ActionRow[]) {
  const rank = { urgente: 0, alta: 1, media: 2 };
  return actions.sort((a, b) => rank[a.prioridad] - rank[b.prioridad]).slice(0, 3);
}

function renderHtml({
  clientName,
  recipientName,
  current,
  delta,
  topActions
}: {
  clientName: string;
  recipientName: string;
  current: DiagnosticRow;
  previous?: DiagnosticRow;
  delta: number | null;
  topActions: ActionRow[];
}) {
  const actionItems = topActions.length
    ? topActions.map((action) => `<li><strong>${escapeHtml(action.titulo)}</strong><br/><span>${escapeHtml(action.descripcion ?? "")}</span></li>`).join("")
    : "<li>No hay acciones abiertas para esta semana.</li>";

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#171625;line-height:1.5">
      <h1 style="color:#3C3489">Resumen semanal MeliGrowth</h1>
      <p>Hola ${escapeHtml(recipientName)}, este es el resumen semanal de ${escapeHtml(clientName)}.</p>
      <div style="border:1px solid #E5E5EA;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#71717A">Score actual</p>
        <p style="font-size:36px;font-weight:700;margin:4px 0;color:#534AB7">${current.score_global}</p>
        <p style="margin:0">Variación vs semana anterior: <strong>${formatDelta(delta)}</strong></p>
      </div>
      <h2>Score por bloque</h2>
      <ul>
        <li>Salud: ${current.score_salud ?? "-"}</li>
        <li>Publicaciones: ${current.score_publicaciones ?? "-"}</li>
        <li>Publicidad: ${current.score_ads ?? "-"}</li>
        <li>Logística: ${current.score_logistica ?? "-"}</li>
        <li>Stock: ${current.score_stock ?? "-"}</li>
      </ul>
      <h2>Acciones principales</h2>
      <ol>${actionItems}</ol>
      <p style="color:#71717A">Adjuntamos el PDF con el resumen ejecutivo.</p>
    </div>
  `;
}

async function sendEmail({
  apiKey,
  from,
  to,
  subject,
  html,
  pdfBase64,
  filename
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  pdfBase64: string;
  filename: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      attachments: [{ filename, content: pdfBase64 }]
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false as const, error: JSON.stringify(data) };
  return { ok: true as const, id: data.id as string };
}

function generatePdf(lines: string[]) {
  const escaped = lines.map((line) => line.replace(/[()\\]/g, "\\$&"));
  const text = escaped.map((line, index) => `BT /F1 12 Tf 50 ${760 - index * 24} Td (${line}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function formatDelta(delta: number | null) {
  if (delta === null) return "Sin comparación";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
