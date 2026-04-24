import type { Plan } from "@/lib/types";

export type PricingInput = {
  plan: Plan;
  currentRevenue: number;
  projectedRevenue: number;
  grossMarginPct: number;
  deliveryCost: number;
  setupFee: number;
  months: number;
};

export type PricingPlanConfig = {
  fixedFee: number;
  growthCommissionPct: number;
  minRecommendedRevenue: number;
};

export type PricingResult = ReturnType<typeof calculatePricing>;

export type PricingSignal = {
  tone: "success" | "warning" | "danger";
  title: string;
  detail: string;
};

export const pricingPlans: Record<Plan, PricingPlanConfig> = {
  starter: {
    fixedFee: 350_000,
    growthCommissionPct: 4,
    minRecommendedRevenue: 3_000_000
  },
  growth: {
    fixedFee: 650_000,
    growthCommissionPct: 6,
    minRecommendedRevenue: 8_000_000
  },
  scale: {
    fixedFee: 1_100_000,
    growthCommissionPct: 8,
    minRecommendedRevenue: 18_000_000
  }
};

export function toNumber(value: string | string[] | undefined, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePricingPlan(value: string | string[] | undefined): Plan {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "starter" || raw === "scale") return raw;
  return "growth";
}

export function calculatePricing(input: PricingInput) {
  const planConfig = pricingPlans[input.plan];
  const growth = Math.max(0, input.projectedRevenue - input.currentRevenue);
  const variableCommission = Math.round(growth * (planConfig.growthCommissionPct / 100));
  const monthlyFee = planConfig.fixedFee + variableCommission;
  const contributionMargin = Math.round(growth * (input.grossMarginPct / 100));
  const clientNetContribution = contributionMargin - monthlyFee;
  const operatorProfit = monthlyFee - input.deliveryCost;
  const operatorMarginPct = monthlyFee > 0 ? Math.round((operatorProfit / monthlyFee) * 100) : 0;
  const totalContractValue = monthlyFee * input.months + input.setupFee;
  const paybackRatio = monthlyFee > 0 ? Number((contributionMargin / monthlyFee).toFixed(1)) : 0;

  return {
    plan: input.plan,
    fixedFee: planConfig.fixedFee,
    growthCommissionPct: planConfig.growthCommissionPct,
    minRecommendedRevenue: planConfig.minRecommendedRevenue,
    growth,
    variableCommission,
    monthlyFee,
    contributionMargin,
    clientNetContribution,
    operatorProfit,
    operatorMarginPct,
    totalContractValue,
    paybackRatio,
    recommended:
      input.currentRevenue >= planConfig.minRecommendedRevenue &&
      input.projectedRevenue > input.currentRevenue &&
      operatorMarginPct >= 35 &&
      clientNetContribution > 0
  };
}

export function comparePricingPlans(input: PricingInput) {
  return (Object.keys(pricingPlans) as Plan[]).map((plan) => calculatePricing({ ...input, plan }));
}

export function selectRecommendedPricingPlan(input: PricingInput) {
  const viablePlans = comparePricingPlans(input).filter((result) => result.recommended);
  if (viablePlans.length > 0) return viablePlans[0];

  return comparePricingPlans(input)
    .slice()
    .sort((a, b) => {
      const aScore = a.operatorMarginPct + a.paybackRatio * 10 + (a.clientNetContribution > 0 ? 20 : -20);
      const bScore = b.operatorMarginPct + b.paybackRatio * 10 + (b.clientNetContribution > 0 ? 20 : -20);
      return bScore - aScore;
    })[0];
}

export function getPricingSignals(input: PricingInput, result: PricingResult): PricingSignal[] {
  const signals: PricingSignal[] = [];

  if (input.projectedRevenue <= input.currentRevenue) {
    signals.push({
      tone: "danger",
      title: "Sin crecimiento proyectado",
      detail: "La comisión variable queda en cero; conviene revisar el objetivo antes de presentar la propuesta."
    });
  } else {
    signals.push({
      tone: "success",
      title: "Crecimiento positivo",
      detail: `El escenario proyecta $${result.growth.toLocaleString("es-AR")} de crecimiento mensual.`
    });
  }

  if (input.currentRevenue < result.minRecommendedRevenue) {
    signals.push({
      tone: "warning",
      title: "Facturación base baja para el plan",
      detail: "El plan seleccionado puede quedar sobredimensionado para la cuenta actual."
    });
  }

  if (result.operatorMarginPct < 35) {
    signals.push({
      tone: "danger",
      title: "Margen MeliGrowth bajo",
      detail: "Ajustar fee, comisión o costo operativo antes de avanzar comercialmente."
    });
  } else {
    signals.push({
      tone: "success",
      title: "Margen operativo sano",
      detail: "El escenario supera el umbral interno mínimo de 35%."
    });
  }

  if (result.clientNetContribution <= 0) {
    signals.push({
      tone: "danger",
      title: "ROI cliente negativo",
      detail: "El margen incremental no cubre el fee mensual estimado."
    });
  } else if (result.paybackRatio < 1.5) {
    signals.push({
      tone: "warning",
      title: "Retorno ajustado",
      detail: "El cliente recupera el fee, pero el colchón de valor es bajo."
    });
  } else {
    signals.push({
      tone: "success",
      title: "Retorno defendible",
      detail: "La contribución incremental deja espacio para justificar el fee."
    });
  }

  return signals;
}
