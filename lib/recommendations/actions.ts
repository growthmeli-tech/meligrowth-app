import type { ScoreStatus } from "@/lib/recommendations/types";

type ActionMatrix = Record<ScoreStatus, string>;

const baseHealthy: Pick<ActionMatrix, "muy_bueno" | "platinum"> = {
  muy_bueno: "Muy buen desempeno. Mantener y monitorear.",
  platinum: "Perfecto. Mantener disciplina operativa."
};

export const ACCIONES_POR_METRICA: Record<string, ActionMatrix> = {
  reclamos: {
    critico: "URGENTE: auditar pedidos ultimos 7 dias y activar plan de contingencia post-venta.",
    en_riesgo: "Revisar proceso post-venta y bajar reclamos a <0.5% esta semana.",
    en_desarrollo: "Atacar los 3 motivos mas frecuentes de reclamos.",
    solido: "Mantener proceso y monitorear semanalmente.",
    ...baseHealthy
  },
  mediaciones: {
    critico: "URGENTE: resolver mediaciones abiertas en 24h y escalar internamente.",
    en_riesgo: "Implementar respuesta proactiva para evitar nuevas mediaciones.",
    en_desarrollo: "Auditar causas y ajustar flujo de atencion para llevarlo a <0.2%.",
    solido: "Mantener proceso y revisar mensualmente.",
    ...baseHealthy
  },
  cancelaciones_vendedor: {
    critico: "URGENTE: verificar stock real de todos los SKUs activos y pausar sin stock.",
    en_riesgo: "Sincronizar inventario antes de aceptar pedidos.",
    en_desarrollo: "Optimizar flujo de aceptacion y sincronizacion para llevarlo a <0.2%.",
    solido: "Mantener sincronizacion de stock semanal.",
    ...baseHealthy
  },
  envios_a_tiempo: {
    critico: "CRITICO: revisar SLA logistico hoy y escalar operativamente.",
    en_riesgo: "Urgente: revisar cuellos de botella de preparacion y despacho.",
    en_desarrollo: "Elevar a >95% auditando pedidos demorados de la ultima semana.",
    solido: "Optimizar preparacion para llegar a >97%.",
    ...baseHealthy
  },
  pubs_activas_pct: {
    critico: "URGENTE: reactivar top 20 SKUs por ventas que hoy estan inactivos.",
    en_riesgo: "Reactivar publicaciones pausadas con mayor potencial comercial.",
    en_desarrollo: "Auditar catalogo y llevar activas a >65%.",
    solido: "Cerrar brecha para superar >75%.",
    ...baseHealthy
  },
  pubs_optimizadas_pct: {
    critico: "Priorizar titulo, fotos y ficha tecnica en top 10 SKUs.",
    en_riesgo: "Optimizar de inmediato top 20 SKUs con mayor trafico.",
    en_desarrollo: "Llevar optimizacion a >75% con foco en titulo y fotos.",
    solido: "Cerrar brecha hacia >80% en publicaciones claves.",
    ...baseHealthy
  },
  ctr: {
    critico: "CTR critico: redisenar imagen principal, titulo y precio competitivo.",
    en_riesgo: "Optimizar imagen y titulo de las 10 publicaciones con mas impresiones.",
    en_desarrollo: "Llevar CTR a >2.5% con mejoras creativas en top SKUs.",
    solido: "Testear variaciones de portada para ganar eficiencia incremental.",
    ...baseHealthy
  },
  acos: {
    critico: "Pausar campanas no rentables y dejar solo ROAS sobre break-even.",
    en_riesgo: "Revisar pujas y keywords caras para bajar ACOS a <15%.",
    en_desarrollo: "Optimizar segmentacion y pujas para bajar de 12%.",
    solido: "Reducir ACOS a <8% en campanas principales.",
    muy_bueno: "Eficiente: escalar con control en campanas validadas.",
    platinum: "ACOS optimo: escalar agresivo en top campanas."
  },
  roas: {
    critico: "ROAS debajo del break-even: pausar y redisenar estrategia.",
    en_riesgo: "Frenar escalado y optimizar antes de invertir mas.",
    en_desarrollo: "ROAS aceptable pero no escalable: ajustar mix de campanas.",
    solido: "Escalar con control sobre campanas validadas.",
    muy_bueno: "ROAS excelente: ampliar inversion en SKUs de alto margen.",
    platinum: "ROAS optimo: abrir nuevas campanas ganadoras."
  },
  incidencias_pct: {
    critico: "Auditar causas de incidencias hoy y corregir empaque/dispatch.",
    en_riesgo: "Reducir incidencias auditando ultimos 30 dias.",
    en_desarrollo: "Llevar incidencias a <0.7% priorizando SKUs conflictivos.",
    solido: "Mantener proceso y cerrar brecha para Platinum.",
    ...baseHealthy
  },
  uso_full_flex_pct: {
    critico: "Plan urgente de migracion Full/Flex en SKUs de mayor rotacion.",
    en_riesgo: "Mover SKUs mas vendidos a Full para bajar friccion.",
    en_desarrollo: "Elevar uso a >70% priorizando SKUs rentables.",
    solido: "Planificar siguiente ola de migracion para superar >70%.",
    ...baseHealthy
  },
  cancelaciones_stock_pct: {
    critico: "URGENTE: sincronizar stock en tiempo real y corregir quiebres.",
    en_riesgo: "Mejorar reposicion y control previo de inventario.",
    en_desarrollo: "Reducir a <0.8% reforzando reposicion top SKUs.",
    solido: "Optimizar reposicion para bajar a <0.4%.",
    ...baseHealthy
  },
  skus_sin_stock_pct: {
    critico: "URGENTE: reponer inmediatamente top 20 SKUs por ventas.",
    en_riesgo: "Priorizar reposicion de SKUs de alta rotacion.",
    en_desarrollo: "Bajar a <2% y revisar proceso de reposicion.",
    solido: "Monitorear agotamiento temprano y sostener <2%.",
    ...baseHealthy
  },
  dias_stock: {
    critico: "Riesgo de quiebre: reposicion de emergencia en SKUs con <7 dias.",
    en_riesgo: "Reponer en 48h para evitar quiebres operativos.",
    en_desarrollo: "Llevar cobertura al rango seguro de 20-35 dias.",
    solido: "Mantener cobertura y estabilizar en 20-35 dias.",
    ...baseHealthy
  },
  lead_time_reposicion: {
    critico: "Lead time critico: renegociar proveedor o cambiar alternativa.",
    en_riesgo: "Reducir tiempos de entrega con compromisos comerciales.",
    en_desarrollo: "Optimizar proceso para llevar lead time a <5 dias.",
    solido: "Mantener y mejorar para acercarse al rango Platinum.",
    ...baseHealthy
  }
};

