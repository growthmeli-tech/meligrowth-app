import { describe, expect, it } from "vitest";
import { resolveLogisticsOperatingCostBreakdown } from "@/lib/pricing/logistics-operating-cost";

describe("resolveLogisticsOperatingCostBreakdown", () => {
  it("Retiro → operating 0 retire_no_cost complete", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Retiro domicilio",
      financialSettings: { internalLogisticsCost: 5000 },
      rowInternalLogisticsCost: null
    });
    expect(r.mode).toBe("retire");
    expect(r.operatingCost).toBe(0);
    expect(r.source).toBe("retire_no_cost");
    expect(r.completeness).toBe("complete");
  });

  it("Flex + row internal 3000 → flex_config complete", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Flex",
      financialSettings: { internalLogisticsCost: 1000 },
      rowInternalLogisticsCost: 3000
    });
    expect(r.operatingCost).toBe(3000);
    expect(r.source).toBe("flex_config");
    expect(r.completeness).toBe("complete");
  });

  it("Flex + account internal only → flex_config", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Flex",
      financialSettings: { internalLogisticsCost: 2500 },
      rowInternalLogisticsCost: null
    });
    expect(r.operatingCost).toBe(2500);
    expect(r.source).toBe("flex_config");
  });

  it("Flex missing internal → partial + flex_internal_logistics_cost", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Flex",
      financialSettings: null,
      rowInternalLogisticsCost: null
    });
    expect(r.operatingCost).toBeNull();
    expect(r.completeness).toBe("partial");
    expect(r.missing).toContain("flex_internal_logistics_cost");
  });

  it("Full missing Full costs → partial + missing keys", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Full",
      financialSettings: { internalLogisticsCost: 100 },
      rowInternalLogisticsCost: null
    });
    expect(r.operatingCost).toBeNull();
    expect(r.completeness).toBe("partial");
    expect(r.missing).toEqual(
      expect.arrayContaining(["full_fulfillment_cost", "full_storage_cost", "full_inbound_cost"])
    );
  });

  it("Full configured sums operatingCost", () => {
    const r = resolveLogisticsOperatingCostBreakdown({
      logistica: "Full",
      financialSettings: {
        fullFulfillmentCostPerUnit: 100,
        fullStorageCostPerUnit: 50,
        fullInboundCostPerUnit: 25
      },
      rowInternalLogisticsCost: null
    });
    expect(r.operatingCost).toBe(175);
    expect(r.source).toBe("full_config");
    expect(r.completeness).toBe("complete");
  });
});
