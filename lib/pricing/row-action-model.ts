import type { CashInDisplay, OptimalPriceDisplay, ProfitDisplay } from "@/lib/pricing/financial-display";
import type { OperabilityStatus } from "@/lib/pricing/data-reliability";
import type { SellerShippingCostStatus } from "@/lib/pricing/operability-resolver";

export type RowPrimaryAction =
  | "configure_cost"
  | "edit_cost"
  | "push_ml_price"
  | "complete_data"
  | "none";

export type RowActionSeverity = "success" | "warning" | "blocked" | "neutral";

export type RowActionModel = {
  itemId: string | null;
  pricingSkuId: string | null;

  primaryAction: RowPrimaryAction;
  severity: RowActionSeverity;

  label: string;
  sublabel: string | null;

  canConfigureCost: boolean;
  canEditCost: boolean;

  canPushMlPrice: boolean;
  pushMlPriceLabel: string | null;
  pushMlPricePayload: {
    itemId: string;
    currentPrice: number;
    targetPrice: number;
  } | null;

  blockedReason: string | null;
  missingFields: string[];

  automationReady: boolean;
};

export type BuildRowActionModelInput = {
  itemId: string | null;
  pricingSkuId: string | null;
  currentPrice: number | null;
  recommendedPrice: number | null;
  productCost: number | null;
  freeShipping: boolean | null;
  operabilityStatus: OperabilityStatus;
  profitDisplay: ProfitDisplay;
  cashInDisplay: CashInDisplay;
  optimalPriceDisplay: OptimalPriceDisplay;
  sellerShippingCostStatus: SellerShippingCostStatus;
  financialMissing: string[];
  financialCompleteness: "complete" | "partial" | "invalid";
};

function hasValidPrice(v: number | null): v is number {
  return v !== null && Number.isFinite(v) && v > 0;
}

function shippingIncompleteReason(input: {
  freeShipping: boolean | null;
  sellerShippingCostStatus: SellerShippingCostStatus;
}): string | null {
  if (input.freeShipping === null) return "Falta envío ML";
  if (input.freeShipping !== true) return null;
  if (input.sellerShippingCostStatus.kind === "missing_weight") return "Falta peso para envío";
  if (input.sellerShippingCostStatus.kind === "missing_reputation") return "Falta reputación ML";
  if (input.sellerShippingCostStatus.kind === "missing_table") return "Falta tabla de envío";
  if (input.sellerShippingCostStatus.kind !== "applies") return "Falta envío ML";
  return null;
}

function pushLabel(currentPrice: number, targetPrice: number): string {
  const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  return `Actualizar ML: ${ars.format(currentPrice)} → ${ars.format(targetPrice)}`;
}

export function buildRowActionModel(input: BuildRowActionModelInput): RowActionModel {
  const missingFields: string[] = [];
  if (!hasValidPrice(input.currentPrice)) missingFields.push("current_ml_price");
  if (!hasValidPrice(input.recommendedPrice)) missingFields.push("recommended_price");
  if (input.productCost === null || !Number.isFinite(input.productCost)) missingFields.push("product_cost");

  if (input.productCost === null || !Number.isFinite(input.productCost)) {
    return {
      itemId: input.itemId,
      pricingSkuId: input.pricingSkuId,
      primaryAction: "configure_cost",
      severity: "blocked",
      label: "Configurar costo",
      sublabel: null,
      canConfigureCost: true,
      canEditCost: false,
      canPushMlPrice: false,
      pushMlPriceLabel: null,
      pushMlPricePayload: null,
      blockedReason: "Falta costo",
      missingFields,
      automationReady: false
    };
  }

  const shippingSafe =
    input.sellerShippingCostStatus.kind === "applies" || input.sellerShippingCostStatus.kind === "not_applicable";
  const safeToPush =
    Boolean(input.itemId) &&
    input.financialCompleteness === "complete" &&
    hasValidPrice(input.currentPrice) &&
    hasValidPrice(input.recommendedPrice) &&
    input.profitDisplay.kind === "real" &&
    input.cashInDisplay.kind === "real" &&
    input.operabilityStatus === "operable" &&
    shippingSafe;

  if (safeToPush && input.itemId !== null) {
    return {
      itemId: input.itemId,
      pricingSkuId: input.pricingSkuId,
      primaryAction: "push_ml_price",
      severity: "success",
      label: pushLabel(input.currentPrice!, input.recommendedPrice!),
      sublabel: null,
      canConfigureCost: false,
      canEditCost: true,
      canPushMlPrice: true,
      pushMlPriceLabel: pushLabel(input.currentPrice!, input.recommendedPrice!),
      pushMlPricePayload: {
        itemId: input.itemId,
        currentPrice: input.currentPrice!,
        targetPrice: input.recommendedPrice!
      },
      blockedReason: null,
      missingFields,
      automationReady: true
    };
  }

  let reason: string | null = null;
  if (!hasValidPrice(input.currentPrice)) reason = "Falta precio ML";
  else if (!hasValidPrice(input.recommendedPrice)) reason = "Sin precio recomendado";
  else if (input.financialMissing.includes("iibb") || input.financialMissing.includes("tax")) reason = "Falta configuración fiscal";
  else reason = shippingIncompleteReason(input);
  if (!reason && input.profitDisplay.kind === "estimated") reason = "Cálculo parcial";
  if (!reason && input.cashInDisplay.kind === "estimated") reason = "En caja estimado";
  if (!reason && input.operabilityStatus !== "operable") reason = "Cálculo parcial";

  if (reason) {
    return {
      itemId: input.itemId,
      pricingSkuId: input.pricingSkuId,
      primaryAction: "complete_data",
      severity: "warning",
      label: "Completar datos",
      sublabel: reason,
      canConfigureCost: false,
      canEditCost: true,
      canPushMlPrice: false,
      pushMlPriceLabel: null,
      pushMlPricePayload: null,
      blockedReason: reason,
      missingFields,
      automationReady: false
    };
  }

  if (input.itemId && hasValidPrice(input.currentPrice) && hasValidPrice(input.recommendedPrice)) {
    return {
      itemId: input.itemId,
      pricingSkuId: input.pricingSkuId,
      primaryAction: "edit_cost",
      severity: "neutral",
      label: "Editar costo",
      sublabel: null,
      canConfigureCost: false,
      canEditCost: true,
      canPushMlPrice: false,
      pushMlPriceLabel: null,
      pushMlPricePayload: null,
      blockedReason: null,
      missingFields,
      automationReady: false
    };
  }

  return {
    itemId: input.itemId,
    pricingSkuId: input.pricingSkuId,
    primaryAction: "none",
    severity: "neutral",
    label: "Sin acción",
    sublabel: null,
    canConfigureCost: false,
    canEditCost: false,
    canPushMlPrice: false,
    pushMlPriceLabel: null,
    pushMlPricePayload: null,
    blockedReason: null,
    missingFields,
    automationReady: false
  };
}
