import { describe, expect, it } from "vitest";
import { calculatePricing, comparePricingPlans, selectRecommendedPricingPlan, toNumber } from "@/lib/pricing";
import {
  calcRealProfit,
  calcSellingPrice,
  calcShippingCostAtPrice,
  calcStockStatus,
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
  it("calcula ganancia real en Flex + verde", () => {
    const price_ml = 30_000;
    const r = calcRealProfit({
      price_ml,
      costo: 15_600,
      logistica: "Flex",
      reputacion: "Verde / MercadoLíder",
      publicidad_pct: 0.1,
      peso_kg: null
    });
    expect(r.converged).toBe(true);
    const envio = calcShippingCostAtPrice("Flex", price_ml);
    const comision = price_ml * 0.1375;
    const pub = price_ml * 0.1;
    expect(r.comision_$).toBeCloseTo(comision, 1);
    expect(r.envio_$).toBeCloseTo(envio, 1);
    expect(r.publicidad_$).toBeCloseTo(pub, 1);
    expect(r.ganancia_real).toBeCloseTo(price_ml - 15_600 - comision - envio - pub, 1);
  });

  it("usa comisión naranja", () => {
    const r = calcRealProfit({
      price_ml: 10_000,
      costo: 5000,
      logistica: "Retiro domicilio",
      reputacion: "Naranja o Roja",
      publicidad_pct: 0,
      peso_kg: null
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
