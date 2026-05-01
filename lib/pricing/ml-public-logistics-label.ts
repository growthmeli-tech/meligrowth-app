/**
 * Operator-facing copy for ML publication logistics (never internal codes like ME2).
 * Internal `ShippingMode` / `normalizeMlShipping().shippingMode` stay unchanged.
 */

export type PublicLogisticsMode = "full" | "flex" | "me2" | "custom" | "retire" | "unknown";

/** Last line of defense: never show internal ML mode codes in operator UI. */
export function scrubInternalLogisticsCodesFromDisplay(label: string): string {
  return label
    .replace(/\bme2\s+gratis\b/gi, "Mercado Envíos gratis")
    .replace(/\bme2\b/gi, "Mercado Envíos")
    .replace(/\bxd_drop_off\b/gi, "Mercado Envíos")
    .replace(/\bcross_docking\b/gi, "Mercado Envíos")
    .replace(/\bdrop_off\b/gi, "Mercado Envíos")
    .replace(/\bself_service\b/gi, "Flex")
    .replace(/\bfulfillment\b/gi, "Full");
}

export function publicMlLogisticsPublicationLabel(mode: PublicLogisticsMode | null, freeShipping: boolean | null): string {
  let out: string;
  if (mode === null) out = "Sin dato";
  else if (mode === "unknown") out = "Sin dato";
  else if (mode === "retire") out = "Retiro";
  else if (mode === "custom") out = "A coordinar";
  else if (mode === "full") {
    out = freeShipping === true ? "Full gratis" : "Full";
  } else if (mode === "flex") {
    out = freeShipping === true ? "Flex gratis" : "Flex";
  } else if (mode === "me2") {
    out = freeShipping === true ? "Mercado Envíos gratis" : "Mercado Envíos";
  } else out = "Sin dato";
  return scrubInternalLogisticsCodesFromDisplay(out);
}
