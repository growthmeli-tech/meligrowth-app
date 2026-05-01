/**
 * Detail panels (cost editor, calc, ML push, expanded) render below the virtualized grid.
 * Rows involved must stay mounted even if filters change mid-flight — otherwise Configurar opens nothing.
 */
export function catalogDetailPanelOrderedIds(
  filteredIds: readonly string[],
  expanded: string | null,
  inlineCostItemId: string | null,
  inlineCalcItemId: string | null,
  mlPushItemId: string | null
): string[] {
  const want = new Set<string>();
  if (expanded) want.add(expanded);
  if (inlineCostItemId) want.add(inlineCostItemId);
  if (inlineCalcItemId) want.add(inlineCalcItemId);
  if (mlPushItemId) want.add(mlPushItemId);
  if (want.size === 0) return [];
  const inFilter = filteredIds.filter((id) => want.has(id));
  const extra = [...want].filter((id) => !inFilter.includes(id));
  return [...inFilter, ...extra];
}
