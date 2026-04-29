import { describe, expect, it } from "vitest";
import { pickAllowedSnapshotColumns } from "@/lib/internal/block-metrics-scope";
import type { Database } from "@/lib/supabase/database.types";

type Ins = Database["public"]["Tables"]["metric_snapshots"]["Insert"];

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
