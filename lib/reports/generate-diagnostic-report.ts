export type DiagnosticReportData = {
  company_name: string;
  plan: string;
  fecha: string;
  score_global: number;
  estado_global: string;
  score_salud: number;
  score_publicaciones: number;
  score_ads: number;
  score_logistica: number;
  score_stock: number;
  alertas: Array<{
    titulo: string;
    descripcion: string;
    accion_concreta: string;
    prioridad: string;
    categoria: string;
  }>;
  recomendaciones_top3: Array<{
    titulo: string;
    accion_concreta: string;
    impacto_estimado: string;
  }>;
  historial?: Array<{ fecha: string; score_global: number }>;
};

export type DiagnosticReportModel = DiagnosticReportData & {
  estado_label: string;
  score_color: string;
  resumen_ejecutivo: string;
  areas_criticas_count: number;
};

export function toManagerLanguage(input: string): string {
  let output = input;
  output = output.replace(/ACOS\s*([0-9]+(?:[.,][0-9]+)?)%?/gi, "La publicidad consume más de lo que genera");
  output = output.replace(/ROAS\s*([0-9]+(?:[.,][0-9]+)?)x?/gi, (_, value: string) => {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return `Por cada $1 invertido en publicidad, generás $${parsed.toFixed(2)}`;
    }
    return "La inversión en publicidad no está generando retorno";
  });
  output = output.replace(/TACOS\s*([0-9]+(?:[.,][0-9]+)?)%?/gi, "La presión publicitaria sobre ventas está fuera de objetivo");
  output = output.replace(/pubs[_\s]activas\s*([0-9]+(?:[.,][0-9]+)?)%?/gi, "La mitad de tu catálogo no tiene visibilidad");
  output = output.replace(/env[ií]os?\s+a\s+tiempo\s*([0-9]+(?:[.,][0-9]+)?)%?/gi, "1 de cada 10 pedidos llega tarde");
  output = output.replace(/score\s*([0-9]+)\s*en\s*riesgo/gi, "Tu cuenta necesita atención en 3 áreas");
  return output;
}

export function generateDiagnosticReport(data: DiagnosticReportData): DiagnosticReportModel {
  const estadoLabel = getEstadoLabel(data.estado_global);
  const scoreColor = getScoreColor(data.score_global);
  const areasCriticas = getCriticalAreasCount(data);
  const resumen = buildExecutiveSummary(data, areasCriticas);

  return {
    ...data,
    estado_label: estadoLabel,
    score_color: scoreColor,
    resumen_ejecutivo: resumen,
    areas_criticas_count: areasCriticas,
    alertas: data.alertas.map((alerta) => ({
      ...alerta,
      titulo: toManagerLanguage(alerta.titulo),
      descripcion: toManagerLanguage(alerta.descripcion),
      accion_concreta: toManagerLanguage(alerta.accion_concreta)
    })),
    recomendaciones_top3: data.recomendaciones_top3.map((recommendation) => ({
      ...recommendation,
      titulo: toManagerLanguage(recommendation.titulo),
      accion_concreta: toManagerLanguage(recommendation.accion_concreta),
      impacto_estimado: toManagerLanguage(recommendation.impacto_estimado)
    }))
  };
}

function buildExecutiveSummary(data: DiagnosticReportData, criticalAreas: number): string {
  if (data.score_global < 55) {
    return `Tu cuenta está operando por debajo del potencial en ${criticalAreas} áreas críticas.`;
  }
  if (data.score_global < 70) {
    return `Tu cuenta muestra avances, pero todavía hay ${criticalAreas} áreas con brechas que frenan crecimiento.`;
  }
  return "Tu cuenta está en una base sólida y lista para optimizar impacto comercial.";
}

function getCriticalAreasCount(data: DiagnosticReportData): number {
  const scores = [data.score_salud, data.score_publicaciones, data.score_ads, data.score_logistica, data.score_stock];
  return scores.filter((score) => score < 55).length;
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#1A9C48";
  if (score >= 70) return "#2F6FED";
  if (score >= 55) return "#D28A00";
  if (score >= 40) return "#E45C23";
  return "#C23934";
}

function getEstadoLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
