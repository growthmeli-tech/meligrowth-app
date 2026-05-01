import type { MlPublicationLink } from "@/lib/data-v2/unified-catalog";
import { getCachedDecisionState } from "@/lib/pricing/decision-state-cache";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";
import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";
import {
  buildPricingRowInput,
  mergePricingMlLink,
  type PricingDraft,
  type PricingSkuRow
} from "@/lib/pricing/pricing-row-model";

export function pricingTierFromDecision(
  p: SkuDecisionState["decision"]["profitabilityStatus"]
): "destroy" | "risk" | "ok" {
  if (p === "loss") return "destroy";
  if (p === "risk" || p === "low_margin") return "risk";
  return "ok";
}

/** Full scan over rows; each lookup uses the decision cache (O(1) hit when key unchanged). */
export function selectFilteredPricingRowIds(
  rows: PricingSkuRow[],
  getDraft: (id: string) => PricingDraft | undefined,
  mlLinks: Record<string, MlPublicationLink> | undefined,
  mlOverride: Record<string, number>,
  mlAccountId: string,
  financialSettings: SellerFinancialSettings | null,
  q: string,
  riskFilter: "all" | "destroy" | "risk"
): string[] {
  const qq = q.trim().toLowerCase();
  const out: string[] = [];
  for (const r of rows) {
    const d = getDraft(r.id);
    if (!d) continue;
    const ml = mergePricingMlLink(r.id, mlLinks, mlOverride);
    const dec = getCachedDecisionState(r.id, buildPricingRowInput(mlAccountId, r, d, ml, financialSettings));
    const tier = pricingTierFromDecision(dec.decision.profitabilityStatus);
    if (riskFilter === "destroy" && tier !== "destroy") continue;
    if (riskFilter === "risk" && tier !== "risk") continue;
    if (qq) {
      const sku = (r.sku ?? "").toLowerCase();
      const prod = (r.producto ?? "").toLowerCase();
      if (!sku.includes(qq) && !prod.includes(qq)) continue;
    }
    out.push(r.id);
  }
  return out;
}

export function selectVisiblePricingRows(rowsById: Map<string, PricingSkuRow>, ids: string[]): PricingSkuRow[] {
  const out: PricingSkuRow[] = [];
  for (const id of ids) {
    const r = rowsById.get(id);
    if (r) out.push(r);
  }
  return out;
}

export function selectHeaderMetrics(
  rows: PricingSkuRow[],
  getDraft: (id: string) => PricingDraft | undefined,
  mlLinks: Record<string, MlPublicationLink> | undefined,
  mlOverride: Record<string, number>,
  mlAccountId: string,
  financialSettings: SellerFinancialSettings | null
): { weightedMargenObj: number | null; weightedReal: number | null; weightedEstimated: number | null } {
  let wM = 0;
  let accM = 0;
  let wR = 0;
  let accR = 0;
  let wE = 0;
  let accE = 0;
  for (const r of rows) {
    const d = getDraft(r.id);
    if (!d) continue;
    const c = d.costo;
    if (c === null || !Number.isFinite(c) || c <= 0) continue;
    if (d.margen_pct !== null) {
      wM += c;
      accM += d.margen_pct * c;
    }
    const ml = mergePricingMlLink(r.id, mlLinks, mlOverride);
    const dec = getCachedDecisionState(r.id, buildPricingRowInput(mlAccountId, r, d, ml, financialSettings));
    const m = dec.computed.realMarginPct;
    if (m !== null && Number.isFinite(m)) {
      if (dec.computed.profitCompleteness === "net_full") {
        wR += c;
        accR += m * c;
      } else {
        wE += c;
        accE += m * c;
      }
    }
  }
  return {
    weightedMargenObj: wM <= 0 ? null : accM / wM,
    weightedReal: wR <= 0 ? null : accR / wR,
    weightedEstimated: wE <= 0 ? null : accE / wE
  };
}
