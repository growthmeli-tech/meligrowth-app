import type { Action, Diagnostic, Priority } from "@/lib/types";

function action(
  diagnostic: Diagnostic,
  prioridad: Priority,
  bloque: Action["bloque"],
  titulo: string,
  descripcion: string
): Action {
  const due = new Date(diagnostic.date);
  due.setDate(due.getDate() + (prioridad === "urgente" ? 2 : prioridad === "alta" ? 5 : 10));
  return {
    id: `${diagnostic.id}-${bloque}-${titulo.toLowerCase().replaceAll(" ", "-").slice(0, 24)}`,
    clientId: diagnostic.clientId,
    bloque,
    titulo,
    descripcion,
    prioridad,
    estado: "pendiente",
    responsable: "Operador asignado",
    dueDate: due.toISOString()
  };
}

export function generateActions(diagnostic: Diagnostic): Action[] {
  const actions: Action[] = [];

  if (diagnostic.scores.salud < 55 && diagnostic.salud.envios_a_tiempo < 95) {
    actions.push(action(diagnostic, "urgente", "salud", "Envíos a tiempo críticos", "Revisar SLA logístico y motivos de demora antes del próximo corte."));
  }

  if (diagnostic.logistica.uso_full_flex_pct < 50) {
    actions.push(action(diagnostic, "alta", "logistica", "Aumentar Full/Flex", "Llevar cobertura Full/Flex a un mínimo operativo de 70%."));
  }

  if (diagnostic.ads.acos > diagnostic.ads.margen_pre_ads * 0.36) {
    actions.push(action(diagnostic, "urgente", "ads", "ACOS crítico", "Pausar campañas no rentables y reasignar presupuesto a SKUs con margen validado."));
  }

  if (diagnostic.stock.skus_sin_stock_pct > 12) {
    actions.push(action(diagnostic, "alta", "stock", "SKUs sin stock elevados", "Priorizar reposición de productos con ventas históricas y margen positivo."));
  }

  if (diagnostic.publicaciones.pubs_optimizadas_pct < 65) {
    actions.push(action(diagnostic, "media", "publicaciones", "Optimizar publicaciones clave", "Actualizar títulos, fichas técnicas y contenido de las publicaciones con mayor tráfico."));
  }

  return actions;
}
