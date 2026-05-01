import { describe, expect, it } from "vitest";
import { scrubInternalLogisticsCodesFromDisplay } from "@/lib/pricing/ml-public-logistics-label";

describe("scrubInternalLogisticsCodesFromDisplay", () => {
  it("reemplaza códigos crudos que no deben verse en OPS", () => {
    expect(scrubInternalLogisticsCodesFromDisplay("xd_drop_off")).toBe("Mercado Envíos");
    expect(scrubInternalLogisticsCodesFromDisplay("self_service")).toBe("Flex");
    expect(scrubInternalLogisticsCodesFromDisplay("ME2")).toBe("Mercado Envíos");
    expect(scrubInternalLogisticsCodesFromDisplay("fulfillment")).toBe("Full");
  });
});
