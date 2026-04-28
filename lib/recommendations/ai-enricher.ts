// lib/recommendations/ai-enricher.ts
//
// Enriquece las recomendaciones rule-based con Claude:
// - descripcion: texto con valores reales del snapshot
// - accion_concreta: acción ejecutable con números concretos
// - steps: checklist con pasos específicos para ese vendedor
//
// GARANTÍA: si Claude falla por cualquier motivo, el pipeline
// sigue funcionando con las recomendaciones originales.
// Los steps quedan vacíos y el cliente usa el fallback local.

import type { Recommendation } from "@/lib/recommendations/types";
import type { Database } from "@/lib/supabase/database.types";

type MetricSnapshotRow = Database["public"]["Tables"]["metric_snapshots"]["Row"];

export type EnrichedRecommendation = Recommendation & {
  steps: string[];
};

interface ClaudeEnrichedItem {
  id: string;
  descripcion: string;
  accion_concreta: string;
  steps: string[];
}

// Enriquecemos solo urgentes y altas — que son las que persisten como alerts.
// Las de media/baja no se persisten hoy (ver persist.ts), por lo que
// enriquecerlas sería gastar tokens sin impacto visible.
const MAX_TO_ENRICH = 5;

export async function enrichRecommendationsWithClaude(
  recommendations: Recommendation[],
  snapshot: MetricSnapshotRow
): Promise<EnrichedRecommendation[]> {
  const withEmptySteps: EnrichedRecommendation[] = recommendations.map((r) => ({
    ...r,
    steps: []
  }));

  if (recommendations.length === 0) return withEmptySteps;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-enricher] ANTHROPIC_API_KEY no configurada. Usando recomendaciones base.");
    return withEmptySteps;
  }

  const toEnrich = selectTopRecommendations(recommendations);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(toEnrich, snapshot) }]
      })
    });

    if (!response.ok) {
      console.error("[ai-enricher] Error Claude API:", response.status, await response.text());
      return withEmptySteps;
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text: string = data.content?.[0]?.text ?? "";
    const enriched = parseClaudeResponse(text);

    if (enriched.length === 0) {
      console.warn("[ai-enricher] No se pudo parsear respuesta de Claude. Usando base.");
      return withEmptySteps;
    }

    return recommendations.map((rec) => {
      const match = enriched.find((e) => e.id === rec.id);
      if (!match) return { ...rec, steps: [] };
      return {
        ...rec,
        descripcion: match.descripcion,
        accion_concreta: match.accion_concreta,
        steps: match.steps
      };
    });
  } catch (err) {
    console.error("[ai-enricher] Error inesperado:", err);
    return withEmptySteps;
  }
}

function selectTopRecommendations(recommendations: Recommendation[]): Recommendation[] {
  const urgentes = recommendations.filter((r) => r.prioridad === "urgente");
  const altas = recommendations.filter((r) => r.prioridad === "alta");
  const resto = recommendations.filter((r) => r.prioridad !== "urgente" && r.prioridad !== "alta");
  return [...urgentes, ...altas, ...resto].slice(0, MAX_TO_ENRICH);
}

function buildSystemPrompt(): string {
  return `Sos un analista operativo experto en vendedores de MercadoLibre Argentina.
Generás contenido accionable para operadores que gestionan cuentas de vendedores.
Usás los números reales del vendedor en cada texto que generás.
Respondés ÚNICAMENTE con JSON válido. Sin texto antes ni después, sin backticks.`;
}

function buildUserPrompt(recommendations: Recommendation[], snapshot: MetricSnapshotRow): string {
  const metrics = {
    ventas_totales: snapshot.ventas_totales,
    gasto_ads: snapshot.gasto_ads,
    ventas_ads: snapshot.ventas_ads,
    margen_pre_ads: snapshot.margen_pre_ads,
    acos: snapshot.acos,
    roas: snapshot.roas,
    tacos: snapshot.tacos,
    reclamos: snapshot.reclamos,
    mediaciones: snapshot.mediaciones,
    cancelaciones_vendedor: snapshot.cancelaciones_vendedor,
    envios_a_tiempo: snapshot.envios_a_tiempo,
    pubs_activas_pct: snapshot.pubs_activas_pct,
    pubs_optimizadas_pct: snapshot.pubs_optimizadas_pct,
    ctr: snapshot.ctr,
    uso_full_flex_pct: snapshot.uso_full_flex_pct,
    incidencias_pct: snapshot.incidencias_pct,
    cancelaciones_stock_pct: snapshot.cancelaciones_stock_pct,
    skus_sin_stock_pct: snapshot.skus_sin_stock_pct,
    dias_stock: snapshot.dias_stock,
    lead_time_reposicion: snapshot.lead_time_reposicion
  };

  const recsPayload = recommendations.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    metrica: r.metrica_afectada,
    prioridad: r.prioridad,
    benchmark_objetivo: r.benchmark_objetivo,
    impacto_estimado: r.impacto_estimado
  }));

  return `Métricas actuales de la cuenta de MercadoLibre Argentina:
${JSON.stringify(metrics, null, 2)}

Para cada recomendación generá exactamente:
- "descripcion": qué está pasando con esa métrica, con el valor real del vendedor. Máximo 2 oraciones.
- "accion_concreta": qué hacer hoy, con números concretos del vendedor. Máximo 1 oración.
- "steps": array de exactamente 5 pasos para el operador. Cada paso máximo 15 palabras. Usá los valores reales donde aplique (ej: "Llevar Full/Flex de 45% a >70%", no "Llevar Full/Flex a >70%").

Recomendaciones:
${JSON.stringify(recsPayload, null, 2)}

Respondé ÚNICAMENTE con este JSON, sin texto antes ni después:
[
  {
    "id": "<id exacto de la recomendación>",
    "descripcion": "<descripción con números reales>",
    "accion_concreta": "<acción concreta con números>",
    "steps": ["paso 1", "paso 2", "paso 3", "paso 4", "paso 5"]
  }
]`;
}

function parseClaudeResponse(text: string): ClaudeEnrichedItem[] {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ClaudeEnrichedItem =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "descripcion" in item &&
        "accion_concreta" in item &&
        "steps" in item &&
        typeof (item as ClaudeEnrichedItem).id === "string" &&
        typeof (item as ClaudeEnrichedItem).descripcion === "string" &&
        typeof (item as ClaudeEnrichedItem).accion_concreta === "string" &&
        Array.isArray((item as ClaudeEnrichedItem).steps) &&
        (item as ClaudeEnrichedItem).steps.every((s: unknown) => typeof s === "string")
    );
  } catch {
    return [];
  }
}
