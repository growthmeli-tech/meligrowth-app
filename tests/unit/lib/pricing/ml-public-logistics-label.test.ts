import { describe, expect, it } from "vitest";
import { publicMlLogisticsPublicationLabel, scrubInternalLogisticsCodesFromDisplay } from "@/lib/pricing/ml-public-logistics-label";

describe("publicMlLogisticsPublicationLabel", () => {
  it("full + freeShipping", () => {
    expect(publicMlLogisticsPublicationLabel("full", true)).toBe("Full gratis");
    expect(publicMlLogisticsPublicationLabel("full", false)).toBe("Full");
  });

  it("flex + freeShipping", () => {
    expect(publicMlLogisticsPublicationLabel("flex", true)).toBe("Flex gratis");
    expect(publicMlLogisticsPublicationLabel("flex", false)).toBe("Flex");
  });

  it("me2 + freeShipping (never ME2)", () => {
    expect(publicMlLogisticsPublicationLabel("me2", false)).toBe("Mercado Envíos");
    expect(publicMlLogisticsPublicationLabel("me2", true)).toBe("Mercado Envíos gratis");
    expect(publicMlLogisticsPublicationLabel("me2", null)).toBe("Mercado Envíos");
    for (const s of [
      publicMlLogisticsPublicationLabel("me2", false),
      publicMlLogisticsPublicationLabel("me2", true),
      publicMlLogisticsPublicationLabel("me2", null)
    ]) {
      expect(s).not.toMatch(/ME2/i);
    }
  });

  it("retire, custom, unknown, null", () => {
    expect(publicMlLogisticsPublicationLabel("retire", true)).toBe("Retiro");
    expect(publicMlLogisticsPublicationLabel("custom", false)).toBe("A coordinar");
    expect(publicMlLogisticsPublicationLabel("unknown", null)).toBe("Sin dato");
    expect(publicMlLogisticsPublicationLabel(null, false)).toBe("Sin dato");
  });
});

describe("scrubInternalLogisticsCodesFromDisplay", () => {
  it("reemplaza fugas ME2 / me2 por copy de operador", () => {
    expect(scrubInternalLogisticsCodesFromDisplay("ME2")).toBe("Mercado Envíos");
    expect(scrubInternalLogisticsCodesFromDisplay("me2 gratis")).toBe("Mercado Envíos gratis");
    expect(scrubInternalLogisticsCodesFromDisplay("ME2 GRATIS")).toBe("Mercado Envíos gratis");
    expect(scrubInternalLogisticsCodesFromDisplay("Full gratis")).toBe("Full gratis");
  });
});
