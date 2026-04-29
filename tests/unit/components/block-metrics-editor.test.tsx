/** @vitest-environment jsdom */

import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlockMetricsEditor, FIELD_DEPENDENCIES, type BlockMetricRowModel } from "@/components/blocks/block-metrics-editor";

const updateBlockMetrics = vi.fn();

vi.mock("@/app/(internal)/internal/clients/[id]/actions", () => ({
  updateBlockMetrics: (...args: unknown[]) => updateBlockMetrics(...args)
}));

function adsRows(): BlockMetricRowModel[] {
  return [
    {
      metrica: "ventas_totales",
      label: "Ventas totales",
      benchmarkKey: "ads.ventas_totales",
      valor: null,
      column: "ventas_totales",
      valueUnit: "plain"
    },
    {
      metrica: "gasto_ads",
      label: "Gasto en Ads",
      benchmarkKey: "ads.gasto_ads",
      valor: null,
      column: "gasto_ads",
      valueUnit: "plain"
    },
    {
      metrica: "ventas_ads",
      label: "Ventas por Ads",
      benchmarkKey: "ads.ventas_ads",
      valor: null,
      column: "ventas_ads",
      valueUnit: "plain"
    },
    {
      metrica: "ventas_ads_pct",
      label: "% ventas por ads",
      benchmarkKey: "ads.ventas_ads_pct",
      valor: null,
      column: "ventas_ads_pct"
    },
    { metrica: "acos", label: "ACOS", benchmarkKey: "ads.acos", valor: null, column: "acos" },
    { metrica: "roas", label: "ROAS", benchmarkKey: "ads.roas", valor: null, column: "roas" }
  ];
}

function renderEditor() {
  return render(
    createElement(BlockMetricsEditor, {
      mlAccountId: "acc-1",
      block: "ads",
      rows: adsRows(),
      blockSource: null
    })
  );
}

describe("BlockMetricsEditor", () => {
  beforeEach(() => {
    updateBlockMetrics.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("does not call window.alert and does not call updateBlockMetrics when ventas_totales is missing and user saves % ventas por ads", async () => {
    updateBlockMetrics.mockResolvedValue({ success: true, data: undefined });
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Editar % ventas por ads" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Editar % ventas por ads" }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(FIELD_DEPENDENCIES.ventas_ads_pct!.errorMessage);

    expect(updateBlockMetrics).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("renders field-level error below the % input when ventas_totales is null and user tries to save", async () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Editar % ventas por ads" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Editar % ventas por ads" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Ingresá Ventas Totales primero");
  });
});
