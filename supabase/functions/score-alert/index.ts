import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ClientRow = {
  id: string;
  name: string;
  operator_id: string | null;
};

type UserRow = {
  email: string | null;
  name: string | null;
};

type DiagnosticRow = {
  date: string;
  score_global: number;
  score_salud: number | null;
  score_publicaciones: number | null;
  score_ads: number | null;
  score_logistica: number | null;
  score_stock: number | null;
};

const blockLabels = {
  salud: "Salud",
  publicaciones: "Publicaciones",
  ads: "Ads",
  logistica: "Logística",
  stock: "Stock"
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

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: clients, error } = await supabase.from("clients").select("id, name, operator_id").eq("active", true);
  if (error) return json({ ok: false, error: error.message }, 500);

  let created = 0;
  for (const client of (clients ?? []) as ClientRow[]) {
    if (!client.operator_id) continue;
    const { data: operator } = await supabase.from("users").select("email, name").eq("id", client.operator_id).maybeSingle();

    const { data: diagnostics } = await supabase
      .from("diagnostics")
      .select("date, score_global, score_salud, score_publicaciones, score_ads, score_logistica, score_stock")
      .eq("client_id", client.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2);

    const [current, previous] = (diagnostics ?? []) as DiagnosticRow[];
    if (!current) continue;

    if (isStale(current.date)) {
      const alert = {
        client_id: client.id,
        user_id: client.operator_id,
        tipo: "alerta_critica",
        titulo: "Diagnóstico desactualizado",
        mensaje: `${client.name} no tiene diagnóstico actualizado hace más de 7 días.`
      } as const;
      const inserted = await insertOncePerDay(supabase, alert);
      if (inserted) created += 1;
      if (inserted) await sendScoreAlertEmail(client.name, operator as UserRow | null, [alert]);
    }

    if (previous) {
      const delta = Number(current.score_global) - Number(previous.score_global);
      if (delta <= -10) {
        const alert = {
          client_id: client.id,
          user_id: client.operator_id,
          tipo: "score_bajo",
          titulo: "Caída fuerte de score",
          mensaje: `${client.name} bajó ${Math.abs(delta)} puntos: de ${previous.score_global} a ${current.score_global}.`
        } as const;
        const inserted = await insertOncePerDay(supabase, alert);
        if (inserted) created += 1;
        if (inserted) await sendScoreAlertEmail(client.name, operator as UserRow | null, [alert]);
      }
    }

    const criticalBlocks = criticalBlockMessages(current);
    if (criticalBlocks.length > 0) {
      const alert = {
        client_id: client.id,
        user_id: client.operator_id,
        tipo: "alerta_critica",
        titulo: "Bloque crítico detectado",
        mensaje: `${client.name} tiene ${criticalBlocks.join(", ")} en estado crítico.`
      } as const;
      const inserted = await insertOncePerDay(supabase, alert);
      if (inserted) created += 1;
      if (inserted) await sendScoreAlertEmail(client.name, operator as UserRow | null, [alert]);
    }
  }

  return json({ ok: true, created });
});

function isStale(date: string) {
  return Date.now() - new Date(date).getTime() > 7 * 86_400_000;
}

function criticalBlockMessages(diagnostic: DiagnosticRow) {
  return [
    ["salud", diagnostic.score_salud],
    ["publicaciones", diagnostic.score_publicaciones],
    ["ads", diagnostic.score_ads],
    ["logistica", diagnostic.score_logistica],
    ["stock", diagnostic.score_stock]
  ]
    .filter(([, score]) => Number(score ?? 100) < 55)
    .map(([block, score]) => `${blockLabels[block as keyof typeof blockLabels]} (${score})`);
}

async function insertOncePerDay(
  supabase: ReturnType<typeof createClient>,
  notification: {
    client_id: string;
    user_id: string;
    tipo: "score_bajo" | "alerta_critica";
    titulo: string;
    mensaje: string;
  }
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("client_id", notification.client_id)
    .eq("user_id", notification.user_id)
    .eq("titulo", notification.titulo)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .limit(1)
    .maybeSingle();

  if (existing) return false;

  const { error } = await supabase.from("notifications").insert({
    ...notification,
    leida: false
  });

  return !error;
}

function parseRecipients(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

async function sendScoreAlertEmail(
  clientName: string,
  operator: UserRow | null,
  alerts: Array<{ titulo: string; mensaje: string }>
) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || alerts.length === 0) return;

  const from = Deno.env.get("SCORE_ALERT_FROM_EMAIL") || Deno.env.get("REPORT_FROM_EMAIL") || "MeliGrowth <alerts@meligrowth.com>";
  const to = operator?.email ? [operator.email] : [];
  const cc = parseRecipients(Deno.env.get("SCORE_ALERT_CC_EMAILS"));
  const recipients = Array.from(new Set([...to, ...cc]));
  if (recipients.length === 0) return;

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
      to: recipients,
      subject: `Alerta MeliGrowth - ${clientName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;color:#171625;line-height:1.5">
          <h1 style="color:#3C3489">Alerta de cuenta</h1>
          <p>Detectamos cambios que requieren revisión en <strong>${escapeHtml(clientName)}</strong>.</p>
          <ul>${alerts.map((alert) => `<li><strong>${escapeHtml(alert.titulo)}</strong><br/><span>${escapeHtml(alert.mensaje)}</span></li>`).join("")}</ul>
        </div>
      `
    }),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    console.error("score_alert_email_failed", await response.text().catch(() => response.statusText));
  }
}
