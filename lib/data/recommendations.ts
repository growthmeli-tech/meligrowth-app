import { generateRecommendations } from "@/lib/recommendations/engine";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { logServerError } from "@/lib/utils/errors";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

export async function getClientRecommendations(clientId: string): Promise<ActionResult<DiagnosticRecommendations>> {
  const supabase = await createServerSupabaseClient();
  const { data: diagnostic, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !diagnostic) {
    logServerError("getClientRecommendations", error ?? "diagnostic_not_found", { clientId });
    return { success: false, error: "No se encontro diagnostico para este cliente" };
  }

  return { success: true, data: generateRecommendations(diagnostic) };
}

export async function getRecommendationsForDiagnostic(diagnosticId: string): Promise<ActionResult<DiagnosticRecommendations>> {
  const supabase = await createServerSupabaseClient();
  const { data: diagnostic, error } = await supabase.from("diagnostics").select("*").eq("id", diagnosticId).maybeSingle();

  if (error || !diagnostic) {
    logServerError("getRecommendationsForDiagnostic", error ?? "diagnostic_not_found", { diagnosticId });
    return { success: false, error: "Diagnostico no encontrado" };
  }

  return { success: true, data: generateRecommendations(diagnostic) };
}

export async function getUrgentRecommendationsForOperator(
  operatorId: string
): Promise<ActionResult<Array<{ client_name: string; client_id: string; recommendations: DiagnosticRecommendations }>>> {
  const supabase = await createServerSupabaseClient();
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id,name")
    .eq("operator_id", operatorId)
    .eq("active", true);

  if (clientsError || !clients) {
    logServerError("getUrgentRecommendationsForOperator.clients", clientsError ?? "clients_not_found", { operatorId });
    return { success: false, error: "Error al cargar clientes activos" };
  }

  if (clients.length === 0) return { success: true, data: [] };

  const clientIds = clients.map((client) => client.id);
  const { data: diagnostics, error: diagnosticsError } = await supabase
    .from("diagnostics")
    .select("*")
    .in("client_id", clientIds)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (diagnosticsError || !diagnostics) {
    logServerError("getUrgentRecommendationsForOperator.diagnostics", diagnosticsError ?? "diagnostics_not_found", { operatorId });
    return { success: false, error: "Error al cargar diagnosticos recientes" };
  }

  const latestByClient = new Map<string, DiagnosticRow>();
  for (const diagnostic of diagnostics) {
    if (!latestByClient.has(diagnostic.client_id)) latestByClient.set(diagnostic.client_id, diagnostic);
  }

  const results = clients
    .map((client) => {
      const diagnostic = latestByClient.get(client.id);
      if (!diagnostic) return null;
      return {
        client_name: client.name,
        client_id: client.id,
        recommendations: generateRecommendations(diagnostic)
      };
    })
    .filter((item): item is { client_name: string; client_id: string; recommendations: DiagnosticRecommendations } => item !== null)
    .filter((item) => item.recommendations.recomendaciones.some((recommendation) => recommendation.prioridad === "urgente" || recommendation.prioridad === "alta"))
    .sort((a, b) => a.recommendations.score_global - b.recommendations.score_global);

  return { success: true, data: results };
}
