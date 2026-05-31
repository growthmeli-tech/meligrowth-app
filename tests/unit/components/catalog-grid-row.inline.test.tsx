/** @vitest-environment jsdom */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CatalogGridRowMemo } from "@/components/catalog/catalog-grid-row";
import type { RowActionModel } from "@/lib/pricing/row-action-model";

function makeRow(withCost: boolean) {
  return {
    item_id: "MLA1",
    title: "Producto demo",
    thumbnail: null,
    sku: "SKU-1",
    stock: 10,
    status: "active",
    price_ml: 20000,
    precio_calculado: 22000,
    precio_vs_objetivo: "ok",
    costo: withCost ? 10000 : null,
    tiene_costo: withCost,
    dataTrust: {
      operabilityStatus: "operable",
      decisionConfidence: { level: "high", reasons: [] }
    },
    mlOfficial: { publicationLogisticsLabel: "ME2", shippingMode: "me2" },
    decisionState: {
      computed: { profitCompleteness: "net_full", financialCompleteness: "complete", cashInCompleteness: "complete", cashInAmount: 12000 },
      decision: { profitabilityStatus: "healthy", stockStatus: "healthy" },
      ml: { freeShipping: false }
    }
  } as never;
}

describe("CatalogGridRow inline actions", () => {
  function action(over: Partial<RowActionModel>): RowActionModel {
    return {
      itemId: "MLA1",
      pricingSkuId: "sku-1",
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
      missingFields: [],
      automationReady: false,
      ...over
    };
  }

  it("missing cost row opens inline input in same row", () => {
    const onToggleInlineCost = vi.fn();
    render(
      <table>
        <tbody>
          <CatalogGridRowMemo
            style={{ top: 0, height: 76 }}
            rowId="MLA1"
            rowKey="k"
            draftKey=""
            mlKey=""
            saveStatus="idle"
            error={null}
            row={makeRow(false)}
            rowActionKey="configure_cost"
            rowAction={action({
              primaryAction: "configure_cost",
              label: "Configurar costo",
              blockedReason: "Falta costo",
              canConfigureCost: true
            })}
            expanded={false}
            selected={false}
            pending={false}
            inlineCostOpen={false}
            inlineCalcOpen={false}
            margenObjDefault={null}
            costForm={null}
            rowHint={null}
            rowSaveState="idle"
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onToggleInlineCost={onToggleInlineCost}
            onInlineCostFieldChange={() => {}}
            onInlineCostSave={() => {}}
            onInlineCostCancel={() => {}}
            onOpenMlPushRow={() => {}}
          />
        </tbody>
      </table>
    );
    fireEvent.click(screen.getByRole("button", { name: "Configurar costo" }));
    expect(onToggleInlineCost).toHaveBeenCalled();
  });

  it("missing cost row renders only the configure cost action", () => {
    render(
      <table>
        <tbody>
          <CatalogGridRowMemo
            style={{ top: 0, height: 76 }}
            rowId="MLA1"
            rowKey="k"
            draftKey=""
            mlKey=""
            saveStatus="idle"
            error={null}
            row={makeRow(false)}
            rowActionKey="configure_cost"
            rowAction={action({
              primaryAction: "configure_cost",
              label: "Configurar costo",
              blockedReason: "Falta costo",
              canConfigureCost: true
            })}
            expanded={false}
            selected={false}
            pending={false}
            inlineCostOpen={false}
            inlineCalcOpen={false}
            margenObjDefault={null}
            costForm={null}
            rowHint={null}
            rowSaveState="idle"
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onToggleInlineCost={() => {}}
            onInlineCostFieldChange={() => {}}
            onInlineCostSave={() => {}}
            onInlineCostCancel={() => {}}
            onOpenMlPushRow={() => {}}
          />
        </tbody>
      </table>
    );
    expect(screen.getByRole("button", { name: "Configurar costo" })).toBeTruthy();
    expect(screen.queryByText("Falta costo")).toBeNull();
  });

  it("push ML row renders the suggested price only inside the action button", () => {
    const label = "Actualizar ML: $ 20.000 → $ 22.000";
    render(
      <table>
        <tbody>
          <CatalogGridRowMemo
            style={{ top: 0, height: 76 }}
            rowId="MLA1"
            rowKey="k"
            draftKey=""
            mlKey=""
            saveStatus="idle"
            error={null}
            row={makeRow(true)}
            rowActionKey="push_ml_price"
            rowAction={action({
              primaryAction: "push_ml_price",
              label,
              canEditCost: true,
              canPushMlPrice: true,
              pushMlPriceLabel: label,
              pushMlPricePayload: { itemId: "MLA1", currentPrice: 20000, targetPrice: 22000 }
            })}
            expanded={false}
            selected={false}
            pending={false}
            inlineCostOpen={false}
            inlineCalcOpen={false}
            margenObjDefault={null}
            costForm={null}
            rowHint={null}
            rowSaveState="idle"
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onToggleInlineCost={() => {}}
            onInlineCostFieldChange={() => {}}
            onInlineCostSave={() => {}}
            onInlineCostCancel={() => {}}
            onOpenMlPushRow={() => {}}
          />
        </tbody>
      </table>
    );
    expect(screen.getAllByText(label)).toHaveLength(1);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("existing cost row shows Editar and inline cost input when opened", () => {
    render(
      <table>
        <tbody>
          <CatalogGridRowMemo
            style={{ top: 0, height: 76 }}
            rowId="MLA1"
            rowKey="k"
            draftKey=""
            mlKey=""
            saveStatus="idle"
            error={null}
            row={makeRow(true)}
            rowActionKey="edit_cost"
            rowAction={action({
              primaryAction: "edit_cost",
              label: "Editar costo",
              canEditCost: true
            })}
            expanded={false}
            selected={false}
            pending={false}
            inlineCostOpen
            inlineCalcOpen={false}
            margenObjDefault={null}
            costForm={{ costo: "10000", logistica: "Flex", margen: "15", pub: "5" }}
            rowHint={null}
            rowSaveState="idle"
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onToggleInlineCost={() => {}}
            onInlineCostFieldChange={() => {}}
            onInlineCostSave={() => {}}
            onInlineCostCancel={() => {}}
            onOpenMlPushRow={() => {}}
          />
        </tbody>
      </table>
    );
    expect(screen.getByRole("button", { name: "Editar costo" })).toBeTruthy();
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
  });

  it("renders exact blocked reason from row action model", () => {
    render(
      <table>
        <tbody>
          <CatalogGridRowMemo
            style={{ top: 0, height: 76 }}
            rowId="MLA1"
            rowKey="k"
            draftKey=""
            mlKey=""
            saveStatus="idle"
            error={null}
            row={makeRow(true)}
            rowActionKey="complete_data"
            rowAction={action({
              primaryAction: "complete_data",
              label: "Completar datos",
              sublabel: "Falta precio ML",
              blockedReason: "Falta precio ML"
            })}
            expanded={false}
            selected={false}
            pending={false}
            inlineCostOpen={false}
            inlineCalcOpen={false}
            margenObjDefault={null}
            costForm={null}
            rowHint={null}
            rowSaveState="idle"
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onToggleInlineCost={() => {}}
            onInlineCostFieldChange={() => {}}
            onInlineCostSave={() => {}}
            onInlineCostCancel={() => {}}
            onOpenMlPushRow={() => {}}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText("Falta precio ML")).toBeTruthy();
    expect(screen.queryByText("Fila no operable")).toBeNull();
  });
});
