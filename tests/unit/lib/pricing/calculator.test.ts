import { describe, expect, it } from "vitest";
import { calculatePricing, comparePricingPlans, selectRecommendedPricingPlan, toNumber } from "@/lib/pricing";
import {
  calcRealProfit,
  calcSellingPrice,
  calcShippingCostAtPrice,
  calcStockStatus,
  calculateFinancialCostBreakdown,
  coerceReputacion,
  mlComisionRate,
  normalizePct
} from "@/lib/pricing/calculator";

describe("Calculadora de precios", () => {
  const input = {
    plan: "growth" as const,
    currentRevenue: 8_000_000,
    projectedRevenue: 11_500_000,
    grossMarginPct: 32,
    deliveryCost: 280_000,
    setupFee: 100_000,
    months: 6
  };

  it("calcula fee mensual y margen del operador", () => {
    const result = calculatePricing(input);
    expect(result.variableCommission).toBe(210_000);
    expect(result.monthlyFee).toBe(860_000);
    expect(result.operatorMarginPct).toBe(67);
  });

  it("marca recomendado cuando supera umbrales de negocio", () => {
    expect(calculatePricing(input).recommended).toBe(true);
  });

  it("ordena comparativa de planes y selecciona uno viable", () => {
    const plans = comparePricingPlans(input);
    expect(plans).toHaveLength(3);
    expect(selectRecommendedPricingPlan(input).plan).toBe("starter");
  });

  it("normaliza strings numericos con separador local", () => {
    expect(toNumber("1.500.000")).toBe(1_500_000);
    expect(toNumber("10,5")).toBe(10.5);
  });
});

describe("Motor ML — normalizePct", () => {
  it("normaliza valores 0–1 y 0–100", () => {
    expect(normalizePct(0.1)).toBe(0.1);
    expect(normalizePct(10)).toBe(0.1);
    expect(normalizePct(null)).toBe(0);
    expect(normalizePct(undefined)).toBe(0);
    expect(normalizePct(0)).toBe(0);
  });
});

describe("Motor ML — comisión por reputación", () => {
  it("aplica 13.75% verde y 12% naranja/roja", () => {
    expect(mlComisionRate("Verde / MercadoLíder")).toBe(0.1375);
    expect(mlComisionRate("Naranja o Roja")).toBe(0.12);
    expect(mlComisionRate(null)).toBe(0.1375);
    expect(coerceReputacion(null)).toBe("Verde / MercadoLíder");
    expect(coerceReputacion("naranja")).toBe("Naranja o Roja");
  });
});

describe("Motor ML — calcShippingCostAtPrice", () => {
  it("Retiro domicilio no suma envío", () => {
    expect(calcShippingCostAtPrice("Retiro domicilio", 30_000)).toBe(0);
  });

  it("Flex incluye % y tramo fijo bajo 33k", () => {
    const p = 30_000;
    expect(calcShippingCostAtPrice("Flex", p)).toBeCloseTo(0.07 * p + 3030, 1);
  });

  it("Full incluye % y tramo fijo bajo 33k", () => {
    const p = 20_000;
    expect(calcShippingCostAtPrice("Full", p)).toBeCloseTo(0.1 * p + 2190, 1);
  });
});

describe("Motor ML — calcRealProfit", () => {
  it("compra envío: freeShipping false → envío 0 en costo vendedor", () => {
    const price_ml = 30_000;
    const r = calcRealProfit({
      price_ml,
      productCost: 15_600,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0.1,
      peso_kg: null,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      shipping: {
        packageWeightKg: 1,
        reputation: "yellow",
        shippingMode: "flex",
        freeShipping: false,
        condition: "new"
      }
    });
    expect(r.converged).toBe(true);
    expect(r.envio_$).toBe(0);
    const comision = price_ml * 0.1375;
    const pub = price_ml * 0.1;
    expect(r.comision_$).toBeCloseTo(comision, 1);
    expect(r.publicidad_$).toBeCloseTo(pub, 1);
    expect(r.ganancia_real).toBeCloseTo(price_ml - 15_600 - comision - pub, 1);
  });

  it("usa comisión naranja", () => {
    const r = calcRealProfit({
      price_ml: 10_000,
      productCost: 5000,
      logistica: "Retiro domicilio",
      reputacion: "Naranja o Roja",
      publicidad_pct: 0,
      peso_kg: null,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null }
    });
    expect(r.comision_$).toBe(1200);
  });
});

describe("Motor ML — calcSellingPrice con % en escala 0–100", () => {
  it("converge con publicidad y margen almacenados como 10 / 15", () => {
    const r = calcSellingPrice({
      costo: 15_600,
      logistica: "Flex",
      publicidad_pct: 10,
      margen_pct: 15,
      reputacion: "Verde / MercadoLíder"
    });
    expect(r.converged).toBe(true);
    expect(r.precio_venta).toBeGreaterThan(20_000);
  });

  it("precio objetivo sube cuando hay IIBB e impuesto explícitos", () => {
    const sinFiscal = calcSellingPrice({
      costo: 10_000,
      logistica: "Flex",
      publicidad_pct: 0.08,
      margen_pct: 0.15,
      reputacion: "Verde / MercadoLíder"
    });
    const conFiscal = calcSellingPrice({
      costo: 10_000,
      logistica: "Flex",
      publicidad_pct: 0.08,
      margen_pct: 0.15,
      reputacion: "Verde / MercadoLíder",
      financialSettings: { iibbPct: 0.02, taxPct: 0.02, internalLogisticsCost: null }
    });
    expect(sinFiscal.converged && conFiscal.converged).toBe(true);
    expect(conFiscal.precio_venta).toBeGreaterThan(sinFiscal.precio_venta);
  });
});

describe("Motor ML — FinancialCostBreakdown / fiscal", () => {
  it("IIBB null → missing incluye iibb, monto null", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 10_000,
      productCost: 4000,
      logistica: "Retiro domicilio",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: null,
      financialSettings: { iibbPct: null, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null
    });
    expect(b.missing).toContain("iibb");
    expect(b.iibbAmount).toBeNull();
    expect(b.adsAmount).toBe(0);
  });

  it("IIBB configurado → iibbAmount = precio * tasa", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 50_000,
      productCost: 10_000,
      logistica: "Retiro domicilio",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0.02, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null
    });
    expect(b.iibbAmount).toBeCloseTo(1000, 1);
    expect(b.missing).not.toContain("iibb");
  });

  it("impuesto configurado → taxAmount = precio * tasa", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 20_000,
      productCost: 5000,
      logistica: "Retiro domicilio",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0.05, internalLogisticsCost: null },
      skuAdditionalFixedCost: null
    });
    expect(b.taxAmount).toBe(1000);
  });

  it("costo adicional fijo SKU + cuenta + %", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 10_000,
      productCost: 3000,
      logistica: "Retiro domicilio",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: {
        iibbPct: 0,
        taxPct: 0,
        internalLogisticsCost: null,
        additionalCostsPct: 0.05,
        additionalCostsFixed: 100
      },
      skuAdditionalFixedCost: 200
    });
    expect(b.additionalCostsAmount).toBeCloseTo(500 + 100 + 200, 1);
  });

  it("break-even sube con IIBB e impuesto", () => {
    const base = (fs: Parameters<typeof calcRealProfit>[0]["financialSettings"]) => ({
      productCost: 8000,
      skuAdditionalFixedCost: null as number | null,
      financialMerged: fs ?? { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      logistica: "Retiro domicilio" as const,
      rep: "Verde / MercadoLíder",
      publicidadPct: 0 as number | null,
      pesoKg: null as number | null
    });
    const profitAt = (p: number, fs: NonNullable<Parameters<typeof calcRealProfit>[0]["financialSettings"]>) =>
      calcRealProfit({
        price_ml: p,
        productCost: base(fs).productCost,
        logistica: base(fs).logistica,
        reputacion: base(fs).rep,
        publicidad_pct: base(fs).publicidadPct,
        peso_kg: base(fs).pesoKg,
        financialSettings: fs,
        skuAdditionalFixedCost: null,
        shipping: { packageWeightKg: null, reputation: "unknown", shippingMode: "unknown", freeShipping: false, condition: "unknown" }
      }).ganancia_real;

    const p0 = 20_000;
    expect(profitAt(p0, { iibbPct: 0, taxPct: 0, internalLogisticsCost: null })).toBeGreaterThan(
      profitAt(p0, { iibbPct: 0.03, taxPct: 0.02, internalLogisticsCost: null })
    );
  });
});

describe("Motor ML — logistics operating + shipping separation", () => {
  const shipFree = {
    packageWeightKg: 0.5 as number,
    reputation: "yellow" as const,
    shippingMode: "flex" as const,
    freeShipping: true as const,
    condition: "new" as const
  };

  it("Retiro → logistics operating 0; internalLogistics cuenta no aplica", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 30_000,
      productCost: 10_000,
      logistica: "Retiro domicilio",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: 5000 },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.logisticsOperating.source).toBe("retire_no_cost");
    expect(b.logisticsOperatingAmount).toBeNull();
    expect(b.internalLogisticsAmount).toBeNull();
    expect(b.shipping.sellerShippingCost).toBe(0);
  });

  it("Flex + internalLogisticsCost 3000 → resta 3000 del total", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 30_000,
      productCost: 10_000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: 3000 },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.logisticsOperating.operatingCost).toBe(3000);
    expect(b.totalCost).not.toBeNull();
    expect(b.netProfit).not.toBeNull();
    const fee = 30_000 * 0.1375;
    expect(b.totalCost).toBeCloseTo(10_000 + fee + 3000, 0);
  });

  it("Flex sin internal → partial y missing logistics_", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 20_000,
      productCost: 5000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: null },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.logisticsOperating.completeness).toBe("partial");
    expect(b.missing.some((m) => m.startsWith("logistics_"))).toBe(true);
  });

  it("freeShipping false + Flex → seller ship 0; operating Flex configurado", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 25_000,
      productCost: 8000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: 500 },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.shipping.source).toBe("buyer_pays_shipping");
    expect(b.mlShippingAmount).toBe(0);
    expect(b.logisticsOperating.operatingCost).toBe(500);
  });

  it("freeShipping true + Flex → sellerShipping + logisticsOperating", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 30_000,
      productCost: 10_000,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: 400 },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: true }
    });
    expect(b.shipping.source).toBe("ml_ar_table_estimate");
    expect(b.shipping.sellerShippingCost).not.toBeNull();
    expect(b.logisticsOperating.operatingCost).toBe(400);
    expect(b.totalCost).not.toBeNull();
    expect((b.totalCost as number) > 10_000).toBe(true);
  });

  it("freeShipping false + Full sin costos Full → operating partial, seller ship 0", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 40_000,
      productCost: 12_000,
      logistica: "Full",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: { iibbPct: 0, taxPct: 0, internalLogisticsCost: 999 },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.shipping.sellerShippingCost).toBe(0);
    expect(b.logisticsOperating.mode).toBe("full");
    expect(b.logisticsOperating.completeness).toBe("partial");
  });

  it("Full con tres costos → suma en total", () => {
    const b = calculateFinancialCostBreakdown({
      salePrice: 50_000,
      productCost: 15_000,
      logistica: "Full",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0,
      financialSettings: {
        iibbPct: 0,
        taxPct: 0,
        internalLogisticsCost: null,
        fullFulfillmentCostPerUnit: 200,
        fullStorageCostPerUnit: 50,
        fullInboundCostPerUnit: 25
      },
      skuAdditionalFixedCost: null,
      shipping: { ...shipFree, freeShipping: false }
    });
    expect(b.logisticsOperating.operatingCost).toBe(275);
    expect(b.totalCost).not.toBeNull();
  });
});

describe("Motor ML — calcStockStatus", () => {
  it("stock 0 → crítico", () => {
    expect(calcStockStatus({ stock_actual: 0, ventas_30d: 30 }).status).toBe("critico");
    expect(calcStockStatus({ stock_actual: 0, ventas_30d: 30 }).urgency).toBe("urgente");
  });

  it("pocos días de cobertura → crítico", () => {
    const ventas_30d = 300;
    const daily = ventas_30d / 30;
    const stock = Math.floor(daily * 5);
    expect(calcStockStatus({ stock_actual: stock, ventas_30d }).status).toBe("critico");
  });

  it("cobertura intermedia → reponer", () => {
    const ventas_30d = 300;
    const daily = ventas_30d / 30;
    const stock = Math.floor(daily * 10);
    const s = calcStockStatus({ stock_actual: stock, ventas_30d });
    expect(s.status).toBe("reponer");
    expect(s.urgency).toBe("pronto");
  });

  it("stock alto vs demanda → exceso", () => {
    const ventas_30d = 30;
    const ideal = ventas_30d * 1.2;
    const stock = Math.ceil(ideal * 2) + 5;
    expect(calcStockStatus({ stock_actual: stock, ventas_30d }).status).toBe("exceso");
  });

  it("sin ventas 30d → saludable salvo stock 0", () => {
    expect(calcStockStatus({ stock_actual: 5, ventas_30d: null }).status).toBe("saludable");
    expect(calcStockStatus({ stock_actual: 5, ventas_30d: null }).days_remaining).toBeNull();
  });
});
