import { explainCashInUnavailable } from "@/lib/pricing/calculator";
import type { SkuDecisionState } from "@/lib/pricing/sku-decision-state";
import type { OperabilityStatus } from "@/lib/pricing/data-reliability";

type Computed = SkuDecisionState["computed"];

export type ProfitDisplay =
  | {
      kind: "real";
      amount: number;
      marginPct: number | null;
      label: "real";
    }
  | {
      kind: "estimated";
      amount: number;
      marginPct: number | null;
      label: "estimado";
      missing: string[];
    }
  | {
      kind: "unavailable";
      amount: null;
      marginPct: null;
      reason: string;
    };

export type CashInDisplay =
  | { kind: "real"; amount: number }
  | { kind: "estimated"; amount: number; missing: string[] }
  | { kind: "unavailable"; reason: string };

export type OptimalPriceDisplay =
  | { kind: "real"; amount: number }
  | { kind: "estimated"; amount: number; subtitle: "Cálculo parcial" }
  | { kind: "unavailable"; subtitle: "Faltan datos" };

function normalizeMissing(computed: Computed): string[] {
  return computed.financialBreakdown?.missing ?? [];
}

function isPartialFinancial(computed: Computed): boolean {
  return computed.profitCompleteness !== "net_full";
}

export function toProfitDisplay(computed: Computed): ProfitDisplay {
  const amount = computed.realProfit;
  const marginPct = computed.realMarginPct;
  if (amount !== null && Number.isFinite(amount)) {
    if (computed.profitCompleteness === "net_full") {
      return {
        kind: "real",
        amount,
        marginPct: marginPct !== null && Number.isFinite(marginPct) ? marginPct : null,
        label: "real"
      };
    }
    return {
      kind: "estimated",
      amount,
      marginPct: marginPct !== null && Number.isFinite(marginPct) ? marginPct : null,
      label: "estimado",
      missing: normalizeMissing(computed)
    };
  }
  return {
    kind: "unavailable",
    amount: null,
    marginPct: null,
    reason: "Faltan datos"
  };
}

export function toCashInDisplay(input: {
  computed: Computed;
  currentPrice: number | null;
  freeShipping: boolean | null;
}): CashInDisplay {
  const amount = input.computed.cashInAmount;
  if (amount !== null && Number.isFinite(amount)) {
    if (isPartialFinancial(input.computed)) {
      return { kind: "estimated", amount, missing: normalizeMissing(input.computed) };
    }
    return { kind: "real", amount };
  }
  return {
    kind: "unavailable",
    reason:
      explainCashInUnavailable(input.currentPrice, input.computed.financialBreakdown, input.freeShipping) ?? "Faltan datos"
  };
}

export function toOptimalPriceDisplay(input: {
  optimalPrice: number | null;
  calculationStatus: SkuDecisionState["sync"]["calculationStatus"];
}): OptimalPriceDisplay {
  if (input.optimalPrice !== null && Number.isFinite(input.optimalPrice)) {
    if (input.calculationStatus === "partial") {
      return { kind: "estimated", amount: input.optimalPrice, subtitle: "Cálculo parcial" };
    }
    return { kind: "real", amount: input.optimalPrice };
  }
  return { kind: "unavailable", subtitle: "Faltan datos" };
}

export function canTriggerMlPricePush(input: {
  decision: SkuDecisionState;
  cashInDisplay: CashInDisplay;
  operabilityStatus: OperabilityStatus | undefined;
  optimalPrice: number | null;
}): boolean {
  return Boolean(
    input.decision.computed.profitCompleteness === "net_full" &&
      input.cashInDisplay.kind === "real" &&
      input.operabilityStatus === "operable" &&
      input.optimalPrice !== null &&
      Number.isFinite(input.optimalPrice)
  );
}
