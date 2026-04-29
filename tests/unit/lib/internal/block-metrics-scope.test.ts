import { describe, expect, it } from "vitest";
import { pickAllowedSnapshotColumns, BLOCK_METRIC_COLUMNS } from "@/lib/internal/block-metrics-scope";
import type { Database } from "@/lib/supabase/database.types";

type Ins = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

describe("BLOCK_METRIC_COLUMNS ads allowlist", () => {
  it("includes ventas_totales, gasto_ads y ventas_ads", () => {
    const cols = BLOCK_METRIC_COLUMNS.ads;
    expect(cols).toContain("ventas_totales");
    expect(cols).toContain("gasto_ads");
    expect(cols).toContain("ventas_ads");
  });
});

describe("pickAllowedSnapshotColumns", () => {
  it("keeps only salud fields when block is salud", () => {
    const input = { reclamos: 1, gasto_ads: 999 } as Partial<Ins>;
    const out = pickAllowedSnapshotColumns("salud", input);
    expect(out).toEqual({ reclamos: 1 });
  });

  it("fails closed: drops columns not in block", () => {
    const input = { reclamos: 1 } as Partial<Ins>;
    const out = pickAllowedSnapshotColumns("ads", input);
    expect(out).toEqual({});
  });
});
