/**
 * Client-safe barrel: types + pure catalog transforms only.
 * Server fetchers live in `unified-catalog.server.ts` (`import "server-only"`).
 */

export type { CatalogHealthSummary, MlPublicationLink, MlSlice, UnifiedCatalogItem } from "./unified-catalog.types";

export {
  computeUnifiedCatalogDerived,
  mapPricingSkusToMlLinks,
  mergeCatalogRowAfterCostSave,
  mergeCatalogRowAfterMlPricePush
} from "./unified-catalog.model";
