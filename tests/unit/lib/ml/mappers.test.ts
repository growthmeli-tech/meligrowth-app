import { describe, expect, it } from "vitest";
import { mapReputationToDiagnostic } from "@/lib/ml/endpoints/reputation";
import { mapScraperMetricsToPrefill } from "@/lib/ml/mappers/to-diagnostic";
import { createMockMLReputation } from "@/tests/helpers/ml-api-mock";

describe("ML mappers", () => {
  it("mapea reputation a campos de diagnostico en porcentaje", () => {
    const result = mapReputationToDiagnostic(
      createMockMLReputation({
        metrics: {
          claims: { rate: 0.006 },
          delayed_handling_time: { rate: 0.1 },
          cancellations: { rate: 0.003 }
        },
        transactions: {
          ratings: { negative: 0.002 }
        }
      })
    );

    expect(result.reclamos).toBeCloseTo(0.6, 1);
    expect(result.envios_a_tiempo).toBeCloseTo(90, 0);
    expect(result.cancelaciones_vendedor).toBeCloseTo(0.3, 1);
    expect(result.mediaciones).toBeCloseTo(0.2, 1);
  });

  it("convierte metricas de scraper a numeros o null", () => {
    const result = mapScraperMetricsToPrefill({
      reclamos: "0.8",
      envios_a_tiempo: "91.3",
      ctr: "not-a-number"
    });

    expect(result.reclamos).toBeCloseTo(0.8);
    expect(result.envios_a_tiempo).toBeCloseTo(91.3);
    expect(result.ctr).toBeNull();
  });
});
