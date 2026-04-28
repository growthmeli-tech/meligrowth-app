export function getTaskSteps(titulo: string, categoria: string): string[] {
  const steps: Record<string, string[]> = {
    ads: [
      "Entrar a Mercado Ads en tu cuenta",
      "Pausar todas las campañas activas",
      "Anotar el gasto y ventas actuales",
      "Revisar estructura de costos con tu equipo",
      "Reiniciar solo campañas con ROAS > break-even"
    ],
    logistica: [
      "Exportar listado de SKUs con mayor rotación",
      "Identificar los que NO están en Full",
      "Calcular costo beneficio de migrar a Full",
      "Iniciar proceso de envío a depósito Full",
      "Confirmar recepción en depósito ML"
    ],
    publicaciones: [
      "Exportar catálogo completo desde ML",
      "Identificar publicaciones pausadas",
      "Revisar motivo de pausa en cada una",
      "Reactivar las que tienen stock disponible",
      "Optimizar título y fotos de las top 10"
    ],
    salud: [
      "Revisar panel de reputación en ML",
      "Identificar reclamos sin responder",
      "Responder todos los reclamos pendientes",
      "Revisar cancelaciones del último mes",
      "Ajustar proceso de publicación vs stock real"
    ],
    stock: [
      "Exportar SKUs con stock = 0",
      "Priorizar los de mayor rotación histórica",
      "Contactar proveedor para reposición urgente",
      "Actualizar fecha estimada de reposición",
      "Confirmar recepción y actualizar publicaciones"
    ]
  };

  const source = `${titulo} ${categoria}`.toLowerCase();
  const key = Object.keys(steps).find((candidate) => source.includes(candidate));
  return steps[key ?? "salud"];
}
