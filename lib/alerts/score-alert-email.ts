import type { ScoreAlert } from "@/lib/score-alerts";

type Recipient = {
  email: string;
  name?: string | null;
};

type SendScoreAlertEmailInput = {
  clientName: string;
  operator?: Recipient | null;
  alerts: ScoreAlert[];
};

type SendScoreAlertEmailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: "missing_config" | "missing_recipient" | "missing_alerts" }
  | { ok: false; error: string };

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

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendScoreAlertEmail({
  clientName,
  operator,
  alerts
}: SendScoreAlertEmailInput): Promise<SendScoreAlertEmailResult> {
  if (alerts.length === 0) return { ok: true, skipped: true, reason: "missing_alerts" };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SCORE_ALERT_FROM_EMAIL || process.env.REPORT_FROM_EMAIL || "MeliGrowth <alerts@meligrowth.com>";
  if (!apiKey) return { ok: true, skipped: true, reason: "missing_config" };

  const to = operator?.email ? [operator.email] : [];
  const cc = parseRecipients(process.env.SCORE_ALERT_CC_EMAILS);
  const recipients = Array.from(new Set([...to, ...cc]));
  if (recipients.length === 0) return { ok: true, skipped: true, reason: "missing_recipient" };

  const alertItems = alerts
    .map((alert) => `<li><strong>${escapeHtml(alert.titulo)}</strong><br/><span>${escapeHtml(alert.mensaje)}</span></li>`)
    .join("");

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
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
          <ul>${alertItems}</ul>
        </div>
      `
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: JSON.stringify(data) };
  return { ok: true };
}
