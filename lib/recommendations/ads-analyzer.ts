import type { AdsAnalysis } from "@/lib/recommendations/types";

export function analyzeAds(input: {
  margen_pre_ads: number;
  gasto_ads: number;
  ventas_ads: number;
  ventas_totales: number;
}): AdsAnalysis {
  const { margen_pre_ads, gasto_ads, ventas_ads, ventas_totales } = input;
  if (gasto_ads <= 0 || ventas_ads <= 0 || ventas_totales <= 0) {
    return {
      acos: 0,
      roas: 0,
      tacos: 0,
      roas_minimo: margen_pre_ads > 0 ? 1 / (margen_pre_ads / 100) : 0,
      diferencial_roas: 0,
      margen_efectivo: 0,
      contribucion_neta: 0,
      estado_salud: "sin_datos",
      recomendacion: "Sin datos de ads suficientes. Activar medicion para tomar decisiones de inversion."
    };
  }

  const acos = (gasto_ads / ventas_ads) * 100;
  const roas = ventas_ads / gasto_ads;
  const tacos = (gasto_ads / ventas_totales) * 100;
  const roas_minimo = margen_pre_ads > 0 ? 1 / (margen_pre_ads / 100) : 0;
  const diferencial_roas = roas - roas_minimo;
  const margen_efectivo = margen_pre_ads - acos;
  const contribucion_neta = ventas_ads * (margen_efectivo / 100);
  const tacosVsMargen = margen_pre_ads > 0 ? tacos / margen_pre_ads : 1;

  if (tacosVsMargen > 0.65) {
    return {
      acos,
      roas,
      tacos,
      roas_minimo,
      diferencial_roas,
      margen_efectivo,
      contribucion_neta,
      estado_salud: "critico",
      recomendacion: "CRITICO: TACOS supera 65% del margen. Reducir inversion y priorizar rentabilidad."
    };
  }

  if (diferencial_roas < 0) {
    return {
      acos,
      roas,
      tacos,
      roas_minimo,
      diferencial_roas,
      margen_efectivo,
      contribucion_neta,
      estado_salud: "critico",
      recomendacion: "CRITICO: ROAS por debajo de break-even. Cada peso invertido destruye margen."
    };
  }

  if (roas >= 6 && tacosVsMargen < 0.13) {
    return {
      acos,
      roas,
      tacos,
      roas_minimo,
      diferencial_roas,
      margen_efectivo,
      contribucion_neta,
      estado_salud: "escalable",
      recomendacion: "ESCALABLE: ROAS alto y TACOS controlado. Escalar con foco en campanas rentables."
    };
  }

  if (tacosVsMargen > 0.2) {
    return {
      acos,
      roas,
      tacos,
      roas_minimo,
      diferencial_roas,
      margen_efectivo,
      contribucion_neta,
      estado_salud: "aceptable",
      recomendacion: "ACEPTABLE: margen ajustado. Optimizar antes de escalar."
    };
  }

  return {
    acos,
    roas,
    tacos,
    roas_minimo,
    diferencial_roas,
    margen_efectivo,
    contribucion_neta,
    estado_salud: "saludable",
    recomendacion: "SALUDABLE: TACOS muy por debajo del margen. Se puede escalar con control."
  };
}
