import { describe, expect, it } from "vitest";
import { parseManualNumericInput, isOptionalManualMetricField } from "@/lib/scoring/metric-semantics";
import {
  emptyManualFormValues,
  hasAdsSnapshotDataForManualForm,
  initialManualFormValuesFromSnapshot,
  metricSnapshotFromManualFormValues,
  scoreDiagnosticFromMetricSnapshot
} from "@/lib/scoring/metric-snapshot";

describe("manual numeric parsing (no silent null→0)", () => {
  it("returns null for blank or missing FormData-like input", () => {
    expect(parseManualNumericInput(undefined)).toBeNull();
    expect(parseManualNumericInput(null)).toBeNull();
    expect(parseManualNumericInput("")).toBeNull();
    expect(parseManualNumericInput("   ")).toBeNull();
  });

  it("returns a finite number for valid strings and numbers", () => {
    expect(parseManualNumericInput("12.5")).toBe(12.5);
    expect(parseManualNumericInput(0)).toBe(0);
    expect(parseManualNumericInput("-3")).toBe(-3);
  });

  it("returns null for non-finite numeric strings", () => {
    expect(parseManualNumericInput("nan")).toBeNull();
    expect(parseManualNumericInput("infinity")).toBeNull();
  });
});

describe("manual form ↔ metric snapshot scoring parity", () => {
  it("optional ctr omitted does not collapse to 0 in snapshot scoring (distinct from ctr=0)", () => {
    const base = emptyManualFormValues();
    base.reclamos = 0.6;
    base.mediaciones = 0.2;
    base.cancelaciones_vendedor = 0.3;
    base.envios_a_tiempo = 90;
    base.pubs_activas_pct = 64.4;
    base.pubs_optimizadas_pct = 70;
    base.margen_pre_ads = 30;
    base.gasto_ads = 20000;
    base.ventas_ads = 10000;
    base.ventas_totales = 30000;
    base.acos = 200;
    base.roas = 0.5;
    base.tacos = 66.7;
    base.incidencias_pct = 1.2;
    base.uso_full_flex_pct = 58;
    base.cancelaciones_stock_pct = 0.8;
    base.skus_sin_stock_pct = 3.6;
    base.dias_stock = 38;
    base.lead_time_reposicion = 9;
    base.sistema_reposicion = 3;
    /* ctr left null */
    const snapOmit = metricSnapshotFromManualFormValues(base);
    const withoutCtr = scoreDiagnosticFromMetricSnapshot(snapOmit, { hasAdsData: hasAdsSnapshotDataForManualForm(base) });

    const baseZero = { ...base, ctr: 0 as number | null };
    const snapZero = metricSnapshotFromManualFormValues(baseZero);
    const withCtrZero = scoreDiagnosticFromMetricSnapshot(snapZero, { hasAdsData: hasAdsSnapshotDataForManualForm(baseZero) });

    expect(withoutCtr.scores.publicaciones).not.toBe(withCtrZero.scores.publicaciones);
  });

  it("classifies Zona B keys as optional for UI/scoring policy", () => {
    expect(isOptionalManualMetricField("ctr")).toBe(true);
    expect(isOptionalManualMetricField("dias_stock")).toBe(true);
    expect(isOptionalManualMetricField("reclamos")).toBe(false);
  });

  it("rehydrates snapshot nulls as form nulls, not coerced numbers", () => {
    const init = initialManualFormValuesFromSnapshot({ ctr: null, dias_stock: null, reclamos: 1.2 } as Record<string, unknown>);
    expect(init.ctr).toBeNull();
    expect(init.dias_stock).toBeNull();
    expect(init.reclamos).toBe(1.2);
  });
});
