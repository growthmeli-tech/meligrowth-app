/** @vitest-environment jsdom */

import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PricingEngineTable } from "@/components/pricing/pricing-engine-table";

const savePricingSkuInputs = vi.fn();
const pushOptimalPriceToML = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>
}));

vi.mock("@/components/pricing/account-fiscal-config-panel", () => ({
  AccountFiscalConfigPanel: () => <div data-testid="fiscal-panel" />
}));

vi.mock("@/app/(ops)/ops/pricing/actions", () => ({
  savePricingSkuInputs: (...args: unknown[]) => savePricingSkuInputs(...args)
}));

vi.mock("@/app/(ops)/ops/catalog/actions", () => ({
  pushOptimalPriceToML: (...args: unknown[]) => pushOptimalPriceToML(...args)
}));

vi.mock("@/lib/pricing/pricing-engine-selectors", () => ({
  selectFilteredPricingRowIds: (rows: Array<{ id: string }>) => rows.map((r) => r.id),
  selectHeaderMetrics: () => ({ weightedMargenObj: null, weightedReal: null, weightedEstimated: null }),
  selectVisiblePricingRows: (rowsById: Map<string, unknown>, filteredIds: string[]) => filteredIds.map((id) => rowsById.get(id)),
  pricingTierFromDecision: () => "ok"
}));

vi.mock("@/lib/pricing/decision-state-cache", () => ({
  makeDecisionCacheKey: () => "decision-key",
  sellerFinancialSettingsFingerprint: () => "fp",
  invalidateDecisionCacheBySkuId: vi.fn(),
  invalidateDecisionCacheByAccountId: vi.fn(),
  getCachedDecisionState: (_id: string, input: { ml: { currentPrice: number | null; freeShipping: boolean | null }; inputs: { productCost: number | null; targetMarginPct: number | null } }) => {
    const missingCost = input.inputs.productCost === null;
    const partial = input.ml.freeShipping === null;
    return {
      ml: {
        currentPrice: input.ml.currentPrice ?? 20000,
        freeShipping: input.ml.freeShipping
      },
      inputs: {
        targetMarginPct: input.inputs.targetMarginPct
      },
      computed: {
        optimalPrice: 21000,
        optimalGananciaUnit: 1200,
        realProfit: missingCost ? null : 700,
        realMarginPct: missingCost ? null : 0.12,
        cashInAmount: 17000,
        profitCompleteness: partial ? "net_partial" : "net_full",
        financialBreakdown: partial ? { missing: ["iibb"] } : { missing: [] }
      },
      decision: {
        profitabilityStatus: missingCost ? "risk" : "healthy",
        stockStatus: "healthy",
        primaryInsight: null
      },
      businessDecision: missingCost
        ? {
            type: "configure_cost",
            priority: "critical",
            message: "Falta costo de producto",
            action: "Configurar"
          }
        : {
            type: "hold",
            priority: "low",
            message: "OK",
            action: "Ninguna"
          },
      sync: {
        calculationStatus: partial ? "partial" : "valid"
      }
    };
  }
}));

function rowWithoutCost() {
  return {
    id: "sku-1",
    ml_account_id: "acc-1",
    sku: "SKU-1",
    producto: "Producto demo",
    costo: null,
    logistica: "Flex",
    publicidad_pct: 0,
    margen_pct: 0.2,
    reputacion: "Verde / MercadoLíder",
    peso_kg: null
  } as never;
}

describe("PricingEngineTable - Configurar flow", () => {
  beforeEach(() => {
    savePricingSkuInputs.mockReset();
    savePricingSkuInputs.mockResolvedValue({ success: true, data: { id: "sku-1" } });
    pushOptimalPriceToML.mockReset();
  });

  it("partial profit and cash-in show estimated markers and blocked reason", async () => {
    const partialRow = { ...(rowWithoutCost() as Record<string, unknown>), id: "sku-2", costo: 10000 } as never;
    render(
      <PricingEngineTable
        rows={[rowWithoutCost(), partialRow]}
        mlLinks={{
          "sku-2": {
            item_id: "MLA2",
            price_ml: 20000,
            stock: 10,
            free_shipping: null,
            logistic_type: "self_service",
            shipping_mode: "me2",
            permalink: "https://example.com/mla2",
            operabilityStatus: "operable"
          } as never
        }}
        mlAccountId="acc-1"
        initialFinancialSettings={null}
      />
    );

    expect(screen.getAllByText(/\u2248/).length).toBeGreaterThan(0);
    expect(screen.getByText("Falta IIBB", { selector: "span" })).toBeTruthy();
  });

  it("click Configurar costo abre editor de costo y Enter guarda cambios", async () => {
    render(
      <PricingEngineTable
        rows={[rowWithoutCost()]}
        mlLinks={{
          "sku-1": {
            item_id: "MLA1",
            price_ml: 20000,
            stock: 10,
            free_shipping: false,
            logistic_type: "self_service",
            shipping_mode: "me2",
            permalink: "https://example.com/mla1",
            operabilityStatus: "operable"
          } as never
        }}
        mlAccountId="acc-1"
        initialFinancialSettings={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Configurar costo" }));
    const costInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(costInput, { target: { value: "12000" } });
    fireEvent.blur(costInput);

    const row = screen.getByText("SKU-1").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.keyDown(row as HTMLElement, { key: "Enter" });

    await waitFor(() => {
      expect(savePricingSkuInputs).toHaveBeenCalledWith("sku-1", "acc-1", expect.objectContaining({ costo: 12000 }));
    });

    expect(screen.getByText(/12\.000/)).toBeTruthy();
    await screen.findByText("✓ Guardado");
  });

  it("safe row shows Actualizar ML CTA", () => {
    render(
      <PricingEngineTable
        rows={[{ ...(rowWithoutCost() as Record<string, unknown>), id: "sku-3", costo: 10000 } as never]}
        mlLinks={{
          "sku-3": {
            item_id: "MLA3",
            price_ml: 20000,
            stock: 10,
            free_shipping: false,
            logistic_type: "self_service",
            shipping_mode: "me2",
            permalink: "https://example.com/mla3",
            operabilityStatus: "operable"
          } as never
        }}
        mlAccountId="acc-1"
        initialFinancialSettings={null}
      />
    );
    expect(screen.getByRole("button", { name: /Actualizar ML:/ })).toBeTruthy();
  });
});
