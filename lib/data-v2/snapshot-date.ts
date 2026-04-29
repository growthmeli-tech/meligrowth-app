/** Fecha de snapshot alineada a `updateBlockMetrics` (UTC). */
export function utcTodaySnapshotDate(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}
