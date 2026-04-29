/**
 * Actividad mínima en Ads para interpretar ACOS/ROAS como performance.
 * Debe mantenerse alineado con `hasMeaningfulAdsActivity` en pipeline de recomendaciones.
 */
export function hasMeaningfulAdsActivity(snapshot: {
  gasto_ads: number | null;
  ventas_ads: number | null;
}): boolean {
  return (
    (typeof snapshot.gasto_ads === "number" && snapshot.gasto_ads > 0) ||
    (typeof snapshot.ventas_ads === "number" && snapshot.ventas_ads > 0)
  );
}
