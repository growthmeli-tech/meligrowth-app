import type { MargenesRow } from "@/lib/ingestion/types";

export type LogisticaForOperating = MargenesRow["logistica"];

/** Solo campos que usa el modelo operativo (evita dependencia circular con `calculator.ts`). */
export type LogisticsFinancialSlice = {
  internalLogisticsCost?: number | null;
  fullFulfillmentCostPerUnit?: number | null;
  fullStorageCostPerUnit?: number | null;
  fullInboundCostPerUnit?: number | null;
};

/** Modo logístico operativo (selector operador / catálogo). */
export type LogisticsMode = "full" | "flex" | "retire" | "me2" | "custom" | "unknown";

export type LogisticsCostBreakdown = {
  mode: LogisticsMode;
  operatingCost: number | null;
  source:
    | "retire_no_cost"
    | "flex_config"
    | "full_config"
    | "custom_config"
    | "missing_config"
    | "unknown";
  completeness: "complete" | "partial" | "not_applicable";
  missing: string[];
  reasons: string[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return v;
}

export function logisticaTypeToLogisticsMode(logistica: LogisticaForOperating): LogisticsMode {
  if (logistica === "Full") return "full";
  if (logistica === "Flex") return "flex";
  if (logistica === "Retiro domicilio") return "retire";
  return "unknown";
}

export type ResolveLogisticsOperatingCostInput = {
  logistica: LogisticaForOperating;
  financialSettings: LogisticsFinancialSlice | null | undefined;
  /** Prioridad 1 sobre `financialSettings.internalLogisticsCost` (Flex). */
  rowInternalLogisticsCost?: number | null;
};

/**
 * Costo operativo por modo logístico (distinto de envío gratis absorbido por tabla ML).
 * Sin valores explícitos no se inventan costos Full/Flex.
 */
export function resolveLogisticsOperatingCostBreakdown(
  input: ResolveLogisticsOperatingCostInput
): LogisticsCostBreakdown {
  const mode = logisticaTypeToLogisticsMode(input.logistica);
  const fs = input.financialSettings ?? null;
  const reasons: string[] = [];

  if (mode === "retire") {
    reasons.push("Retiro: sin costo operativo logístico modelado.");
    return {
      mode,
      operatingCost: 0,
      source: "retire_no_cost",
      completeness: "complete",
      missing: [],
      reasons
    };
  }

  if (mode === "flex") {
    const row = finiteOrNull(input.rowInternalLogisticsCost ?? null);
    const acct = finiteOrNull(fs?.internalLogisticsCost ?? null);
    const val = row !== null ? row : acct;
    if (val !== null) {
      reasons.push("Flex: costo interno logístico explícito (SKU o cuenta).");
      return {
        mode,
        operatingCost: roundMoney(val),
        source: "flex_config",
        completeness: "complete",
        missing: [],
        reasons
      };
    }
    reasons.push("Flex: falta costo interno logístico configurado.");
    return {
      mode,
      operatingCost: null,
      source: "missing_config",
      completeness: "partial",
      missing: ["flex_internal_logistics_cost"],
      reasons
    };
  }

  if (mode === "full") {
    const ff = finiteOrNull(fs?.fullFulfillmentCostPerUnit ?? null);
    const st = finiteOrNull(fs?.fullStorageCostPerUnit ?? null);
    const ib = finiteOrNull(fs?.fullInboundCostPerUnit ?? null);
    const missing: string[] = [];
    if (ff === null) missing.push("full_fulfillment_cost");
    if (st === null) missing.push("full_storage_cost");
    if (ib === null) missing.push("full_inbound_cost");
    if (missing.length === 0) {
      const sum = roundMoney((ff as number) + (st as number) + (ib as number));
      reasons.push("Full: suma de costos operativos explícitos por unidad.");
      return {
        mode,
        operatingCost: sum,
        source: "full_config",
        completeness: "complete",
        missing: [],
        reasons
      };
    }
    reasons.push("Full: faltan uno o más costos operativos explícitos por unidad.");
    return {
      mode,
      operatingCost: null,
      source: "missing_config",
      completeness: "partial",
      missing,
      reasons
    };
  }

  reasons.push("Modo logístico sin costo operativo explícito en el modelo.");
  return {
    mode,
    operatingCost: null,
    source: "missing_config",
    completeness: "partial",
    missing: ["logistics_mode_operating_cost"],
    reasons
  };
}
