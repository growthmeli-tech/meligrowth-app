/**
 * Client-safe barrel: types + pure catalog transforms only.
 * Server fetchers live in `unified-catalog.server.ts` (`import "server-only"`).
 */

export type { CatalogDataTrust, DataCompleteness, DecisionConfidence, OperabilityStatus } from "@/lib/pricing/data-reliability";
export type { CatalogHealthSummary, MlPublicationLink, MlSlice, UnifiedCatalogItem } from "./unified-catalog.types";
export type { ComputeUnifiedCatalogOptions, LocalShippingPolicyOverride } from "./unified-catalog.model";
export type { CatalogEffectiveContext, LocalShippingPolicyOverrides } from "./catalog-effective-row";

export {
  computeUnifiedCatalogDerived,
  mapPricingSkusToMlLinks,
  mergeCatalogRowAfterCostSave,
  mergeCatalogRowAfterMlPricePush,
  orderPricingSkusByUnifiedCatalog,
  recomputeCatalogItemFinancials
} from "./unified-catalog.model";
