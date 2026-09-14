import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  PRICING_SKU_INGEST_SOURCE_PATTERN,
  bulkReplacePricingSkusForFile
} from "@/lib/data-v2/pricing-skus";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

type Call = { op: string; table: string; filters: Record<string, unknown>[] };

function createChain(calls: Call[], table: string, result: { data: unknown; error: unknown }) {
  const filters: Record<string, unknown>[] = [];
  const rec: Call = { op: "pending", table, filters };
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn((..._a: unknown[]) => {
    rec.op = rec.op === "pending" ? "select" : rec.op;
    return builder;
  });
  builder.insert = vi.fn((..._a: unknown[]) => {
    rec.op = "insert";
    return builder;
  });
  builder.delete = vi.fn(() => {
    rec.op = "delete";
    return builder;
  });
  builder.eq = vi.fn((k: string, v: unknown) => {
    filters.push({ eq: [k, v] });
    return builder;
  });
  builder.like = vi.fn((k: string, v: unknown) => {
    filters.push({ like: [k, v] });
    return builder;
  });
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
    calls.push(rec);
    return Promise.resolve(result).then(resolve);
  };
  return builder;
}

describe("bulkReplacePricingSkusForFile", () => {
  const calls: Call[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== "pricing_skus") return createChain(calls, table, { data: null, error: null });
        return createChain(calls, table, { data: [], error: null });
      })
    } as never);
  });

  it("replaces every previous spreadsheet ingest, not only the new storage path", async () => {
    const result = await bulkReplacePricingSkusForFile("acc-1", "acc-1/2026-09-14T12-00-00-margenes.xlsx", [
      {
        ml_account_id: "acc-1",
        sku: "ABC-1",
        producto: "Prod",
        costo: 100,
        logistica: "Flex"
      }
    ]);

    expect(result.success).toBe(true);
    const likeDeletes = calls.filter(
      (c) => c.op === "delete" && c.filters.some((f) => "like" in f && (f.like as unknown[])[1] === PRICING_SKU_INGEST_SOURCE_PATTERN)
    );
    expect(likeDeletes.length).toBeGreaterThanOrEqual(1);
    const pathOnlyDelete = calls.filter(
      (c) =>
        c.op === "delete" &&
        c.filters.some((f) => "eq" in f && (f.eq as unknown[])[0] === "source_file" && (f.eq as unknown[])[1] === "acc-1/2026-09-14T12-00-00-margenes.xlsx") &&
        !c.filters.some((f) => "like" in f)
    );
    expect(pathOnlyDelete).toHaveLength(0);
  });

  it("empty replace only deletes the current upload path (rollback)", async () => {
    const result = await bulkReplacePricingSkusForFile("acc-1", "acc-1/new.xlsx", []);
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.op === "delete" && c.filters.some((f) => "like" in f))).toBe(false);
    expect(
      calls.some(
        (c) =>
          c.op === "delete" &&
          c.filters.some((f) => "eq" in f && (f.eq as unknown[])[1] === "acc-1/new.xlsx")
      )
    ).toBe(true);
  });
});
