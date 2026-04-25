import { generateActions } from "@/lib/actions-engine";
import { sendScoreAlertEmail } from "@/lib/alerts/score-alert-email";
import { generateScoreAlerts } from "@/lib/score-alerts";
import { scoreDiagnostic } from "@/lib/scoring";
import type { Database } from "@/lib/supabase/database.types";
import type { Diagnostic, DiagnosticInput } from "@/lib/types";

type SupabaseClient = {
  from: <T extends keyof Database["public"]["Tables"]>(table: T) => any;
};

export async function persistDiagnostic({
  supabase,
  clientId,
  input,
  date,
  source,
  createdBy
}: {
  supabase: SupabaseClient;
  clientId: string;
  input: DiagnosticInput;
  date: string;
  source: "manual" | "scraping" | "import";
  createdBy?: string | null;
}) {
  const scored = scoreDiagnostic(input);

  const [{ data: clientRow }, { data: previousDiagnostic }] = await Promise.all([
    supabase.from("clients").select("name, operator_id").eq("id", clientId).single(),
    supabase
      .from("diagnostics")
      .select("score_global, score_salud, score_publicaciones, score_ads, score_logistica, score_stock")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const { data: inserted, error } = await supabase
    .from("diagnostics")
    .insert({
      client_id: clientId,
      date,
      score_global: scored.scoreGlobal,
      estado_global: scored.estadoGlobal,
      reclamos: input.salud.reclamos,
      mediaciones: input.salud.mediaciones,
      cancelaciones_vendedor: input.salud.cancelaciones_vendedor,
      envios_a_tiempo: input.salud.envios_a_tiempo,
      score_salud: scored.scores.salud,
      pubs_activas_pct: input.publicaciones.pubs_activas_pct,
      pubs_optimizadas_pct: input.publicaciones.pubs_optimizadas_pct,
      ctr: input.publicaciones.ctr,
      score_publicaciones: scored.scores.publicaciones,
      margen_pre_ads: input.ads.margen_pre_ads,
      gasto_ads: input.ads.gasto_ads,
      ventas_ads: input.ads.ventas_ads,
      ventas_totales: input.ads.ventas_totales,
      acos: input.ads.acos,
      roas: input.ads.roas,
      tacos: input.ads.tacos,
      score_ads: scored.scores.ads,
      incidencias_pct: input.logistica.incidencias_pct,
      uso_full_flex_pct: input.logistica.uso_full_flex_pct,
      cancelaciones_stock_pct: input.logistica.cancelaciones_stock_pct,
      score_logistica: scored.scores.logistica,
      skus_sin_stock_pct: input.stock.skus_sin_stock_pct,
      dias_stock: input.stock.dias_stock,
      lead_time_reposicion: input.stock.lead_time_reposicion,
      sistema_reposicion: input.stock.sistema_reposicion,
      score_stock: scored.scores.stock,
      created_by: createdBy ?? null,
      source
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return { ok: false as const, error: error?.message ?? "No se pudo guardar el diagnóstico" };
  }

  const diagnosticForActions: Diagnostic = {
    id: inserted.id,
    clientId,
    date,
    ...input,
    scoreGlobal: scored.scoreGlobal,
    estadoGlobal: scored.estadoGlobal,
    scores: scored.scores,
    source
  };

  const recommendedActions = generateActions(diagnosticForActions);
  if (recommendedActions.length > 0) {
    const { error: actionsError } = await supabase.from("actions").insert(
      recommendedActions.map((action) => ({
        client_id: clientId,
        created_by: createdBy ?? null,
        bloque: action.bloque,
        titulo: action.titulo,
        descripcion: action.descripcion,
        prioridad: action.prioridad,
        estado: action.estado,
        due_date: action.dueDate.slice(0, 10)
      }))
    );

    if (actionsError) {
      return { ok: false as const, error: actionsError.message };
    }
  }

  const alerts = generateScoreAlerts({
    clientName: clientRow?.name ?? "Cliente",
    previous: previousDiagnostic
      ? {
          scoreGlobal: Number(previousDiagnostic.score_global),
          scores: {
            salud: Number(previousDiagnostic.score_salud ?? 0),
            publicaciones: Number(previousDiagnostic.score_publicaciones ?? 0),
            ads: Number(previousDiagnostic.score_ads ?? 0),
            logistica: Number(previousDiagnostic.score_logistica ?? 0),
            stock: Number(previousDiagnostic.score_stock ?? 0)
          }
        }
      : null,
    current: {
      scoreGlobal: scored.scoreGlobal,
      scores: scored.scores
    }
  });

  const operatorId = clientRow?.operator_id ?? createdBy ?? null;
  if (alerts.length > 0 && operatorId) {
    await supabase.from("notifications").insert(
      alerts.map((alert) => ({
        client_id: clientId,
        user_id: operatorId,
        tipo: alert.tipo,
        titulo: alert.titulo,
        mensaje: alert.mensaje,
        leida: false
      }))
    );

    const { data: operator } = await supabase.from("users").select("email, name").eq("id", operatorId).maybeSingle();
    const emailResult = await sendScoreAlertEmail({
      clientName: clientRow?.name ?? "Cliente",
      operator: operator?.email ? { email: operator.email, name: operator.name } : null,
      alerts
    });

    if (!emailResult.ok) {
      console.error("score_alert_email_failed", emailResult.error);
    }
  }

  return {
    ok: true as const,
    diagnosticId: inserted.id as string,
    diagnostic: inserted as Database["public"]["Tables"]["diagnostics"]["Row"],
    scoreGlobal: scored.scoreGlobal,
    estadoGlobal: scored.estadoGlobal,
    scores: scored.scores,
    actionsCreated: recommendedActions.length,
    alertsCreated: alerts.length
  };
}
