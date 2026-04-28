// Pasos reales extraídos de las planillas de diagnóstico de MeliGrowth
// Fuente: Diagnostico_salud_cuentaLargo_v22 — hoja Carga_Metricas

const PASOS_POR_METRICA: Record<string, string[]> = {
  // 01 SALUD
  reclamos: [
    "Entrar al panel de reputación de ML → Resumen operativo",
    "Identificar los reclamos activos y sus motivos",
    "Responder todos los reclamos sin respuesta en las próximas 24hs",
    "Revisar el proceso de atención post-venta del equipo",
    "Objetivo: llevar reclamos a <0.5%"
  ],
  mediaciones: [
    "Entrar al panel de reputación de ML",
    "Revisar todas las mediaciones activas",
    "Auditar las causas más frecuentes de mediación",
    "Ajustar el proceso de respuesta a compradores",
    "Objetivo: llevar mediaciones a <0.2%"
  ],
  cancelaciones_vendedor: [
    "Entrar al panel de reputación → Cancelaciones",
    "Revisar qué SKUs generaron las cancelaciones",
    "Comparar stock real vs stock publicado en esos SKUs",
    "Corregir el stock publicado para que refleje el stock real",
    "Objetivo: llevar cancelaciones por vendedor a <0.2%"
  ],
  envios_a_tiempo: [
    "Revisar el módulo de reputación o logística en ML",
    "Identificar qué envíos llegaron tarde y por qué",
    "Hablar con el área logística o el transportista",
    "Revisar los SLA de preparación y despacho",
    "Objetivo urgente: volver a >95% para evitar penalización"
  ],

  // 02 PUBLICACIONES
  pubs_activas: [
    "Exportar catálogo completo desde ML",
    "Filtrar las publicaciones pausadas",
    "Identificar motivo de pausa en cada una (stock, precio, calidad)",
    "Reactivar las publicaciones con stock disponible",
    "Objetivo: llevar publicaciones activas a >75%"
  ],
  pubs_optimizadas: [
    "Listar las top 20 publicaciones por ventas",
    "Revisar título, fotos y ficha técnica de cada una",
    "Actualizar títulos con palabras clave relevantes",
    "Reemplazar fotos de baja calidad",
    "Objetivo: llevar publicaciones optimizadas a >75%"
  ],
  ctr: [
    "Entrar a Mercado Ads o reportes de tráfico",
    "Identificar las publicaciones con menor CTR",
    "Mejorar la imagen principal de las top 10 publicaciones",
    "Actualizar el título con palabras clave de mayor búsqueda",
    "Objetivo: llevar CTR a >2.5%"
  ],

  // 03 ADS
  acos: [
    "Entrar a Mercado Ads → Dashboard de campañas",
    "Identificar las campañas con ACOS más alto",
    "Pausar las campañas con ACOS por encima del margen",
    "Reducir pujas en keywords caras con bajo retorno",
    "Objetivo: ACOS < 20% (65% del margen pre-ads)"
  ],
  roas: [
    "Entrar a Mercado Ads → Dashboard de campañas",
    "Calcular ROAS mínimo = 1 / margen pre-ads",
    "Pausar todas las campañas con ROAS por debajo del mínimo",
    "Revisar estructura de costos con el equipo",
    "Objetivo: ROAS real > break-even calculado"
  ],
  tacos: [
    "Calcular TACOS = gasto ads / ventas totales",
    "Si TACOS supera 65% del margen → pausar inversión",
    "Revisar qué porcentaje de ventas vienen de ads",
    "Optimizar las campañas de mayor costo y menor retorno",
    "Objetivo: TACOS < 13% del margen para escalar con control"
  ],

  // 04 LOGÍSTICA
  incidencias: [
    "Entrar al reporte operativo de ML o panel de reputación",
    "Identificar las incidencias más frecuentes del período",
    "Auditar causas: ¿son de preparación, despacho o entrega?",
    "Coordinar con logística para corregir el proceso",
    "Objetivo: llevar incidencias a <0.7%"
  ],
  full_flex: [
    "Exportar listado de SKUs con mayor rotación de ventas",
    "Identificar cuáles NO están en modalidad Full o Flex",
    "Calcular costo-beneficio de migrar cada SKU a Full",
    "Iniciar proceso de envío de los primeros SKUs al depósito ML",
    "Objetivo: llevar uso Full/Flex a >70%"
  ],
  cancelaciones_stock: [
    "Conciliar el reporte de cancelaciones por stock",
    "Identificar los SKUs que generaron más cancelaciones",
    "Revisar proceso de reposición de esos SKUs",
    "Ajustar publicación para reflejar stock real",
    "Objetivo: cancelaciones por stock a <0.5%"
  ],

  // 05 STOCK
  skus_sin_stock: [
    "Exportar catálogo → filtrar SKUs con stock = 0",
    "Priorizar los SKUs de mayor rotación histórica",
    "Contactar proveedor para reposición urgente de los top 10",
    "Confirmar fecha estimada de llegada del stock",
    "Objetivo: SKUs sin stock a <2% del catálogo"
  ],
  sistema_reposicion: [
    "Documentar el proceso actual de reposición",
    "Definir punto de pedido por SKU (stock mínimo antes de comprar)",
    "Establecer un sistema de alertas de stock bajo",
    "Crear un proceso formal de reposición semanal",
    "Objetivo: llegar a nivel 3 (proceso definido) o 4 (automático)"
  ]
};

const FALLBACKS: Record<string, string[]> = {
  salud: PASOS_POR_METRICA.envios_a_tiempo,
  publicaciones: PASOS_POR_METRICA.pubs_activas,
  ads: PASOS_POR_METRICA.acos,
  logistica: PASOS_POR_METRICA.full_flex,
  stock: PASOS_POR_METRICA.skus_sin_stock
};

/** Pasos sugeridos para la checklist; prioriza coincidencia en título + descripción + categoría (bloque). */
export function getTaskSteps(titulo: string, descripcion: string, categoria: string): string[] {
  const texto = `${titulo} ${descripcion} ${categoria}`.toLowerCase();

  if (texto.includes("full") || texto.includes("flex")) return PASOS_POR_METRICA.full_flex;
  if (texto.includes("envio") || texto.includes("tiempo") || texto.includes("sla")) return PASOS_POR_METRICA.envios_a_tiempo;
  if (texto.includes("reclamo")) return PASOS_POR_METRICA.reclamos;
  if (texto.includes("mediacion")) return PASOS_POR_METRICA.mediaciones;
  if (texto.includes("cancelacion") && texto.includes("stock")) return PASOS_POR_METRICA.cancelaciones_stock;
  if (texto.includes("cancelacion")) return PASOS_POR_METRICA.cancelaciones_vendedor;
  if (texto.includes("acos")) return PASOS_POR_METRICA.acos;
  if (texto.includes("roas")) return PASOS_POR_METRICA.roas;
  if (texto.includes("tacos")) return PASOS_POR_METRICA.tacos;
  if (texto.includes("incidencia")) return PASOS_POR_METRICA.incidencias;
  if (texto.includes("optimizad")) return PASOS_POR_METRICA.pubs_optimizadas;
  if (texto.includes("activa") || texto.includes("pausad")) return PASOS_POR_METRICA.pubs_activas;
  if (texto.includes("ctr") || texto.includes("click")) return PASOS_POR_METRICA.ctr;
  if (texto.includes("sin stock") || texto.includes("sku")) return PASOS_POR_METRICA.skus_sin_stock;
  if (texto.includes("reposicion") || texto.includes("sistema")) return PASOS_POR_METRICA.sistema_reposicion;

  const categoriaKey = Object.keys(FALLBACKS).find((k) => texto.includes(k));
  return FALLBACKS[categoriaKey ?? "salud"];
}
