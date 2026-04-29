import { describe, expect, it } from "vitest";
import { parsePricingComercialRows } from "@/lib/ingestion/parsers/parse-pricing-comercial";

const get = (row: Record<string, unknown>, f: string) => row[f];

describe("parsePricingComercialRows", () => {
  it("normaliza margen 40 → 0.4", () => {
    const r = parsePricingComercialRows(
      [
        {
          plan: "A",
          current_revenue: 1,
          projected_revenue: 2,
          gross_margin_pct: 40,
          delivery_cost: 0.1,
          months: 3
        }
      ],
      get
    );
    expect(r.valid[0]?.gross_margin_pct).toBeCloseTo(0.4);
  });
});
