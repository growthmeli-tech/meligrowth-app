import type { Database } from "@/lib/supabase/database.types";
import { generateRecommendations } from "@/lib/recommendations/engine";

type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

export function buildRecommendationsPipeline(diagnostic: DiagnosticRow) {
  return {
    diagnostic,
    recommendations: generateRecommendations(diagnostic)
  };
}
