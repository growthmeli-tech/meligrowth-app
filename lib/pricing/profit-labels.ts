import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";

/** Etiquetas de completitud fiscal / margen (sin fórmulas; solo lectura de `decisionState`). */
export function netMarginDisplayLabel(computed: SkuDecisionState["computed"]): string {
  if (computed.profitCompleteness === "net_full") return "margen neto";
  if (computed.profitCompleteness === "net_partial") {
    const m = computed.financialBreakdown?.missing ?? [];
    const parts: string[] = ["margen parcial"];
    if (m.includes("iibb")) parts.push("faltan IIBB");
    if (m.includes("tax")) parts.push("faltan impuestos");
    return parts.join(" · ");
  }
  return "";
}
