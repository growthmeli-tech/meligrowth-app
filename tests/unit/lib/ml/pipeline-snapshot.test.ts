import { describe, expect, it } from "vitest";
import {
  buildMlPipelineSnapshotPayload,
  preserveManualSnapshotFields
} from "@/lib/ml/pipeline-snapshot";
import type { MlDataSource } from "@/lib/ml/mappers/types";

const sources: Record<string, MlDataSource> = {
  salud: "api",
  publicaciones: "api",
  ads: "api",
  logistica: "api",
  stock: "api"
};

describe("preserveManualSnapshotFields", () => {
  it("keeps Excel/manual margen_pre_ads and sistema_reposicion", () => {
    expect(preserveManualSnapshotFields({ margen_pre_ads: 18.5, sistema_reposicion: 80 })).toEqual({
      margen_pre_ads: 18.5,
      sistema_reposicion: 80
    });
  });

  it("treats missing existing snapshot as nulls", () => {
    expect(preserveManualSnapshotFields(null)).toEqual({
      margen_pre_ads: null,
      sistema_reposicion: null
    });
  });

  it("ignores non-finite values", () => {
    expect(preserveManualSnapshotFields({ margen_pre_ads: Number.NaN, sistema_reposicion: Number.POSITIVE_INFINITY })).toEqual({
      margen_pre_ads: null,
      sistema_reposicion: null
    });
  });
});

describe("buildMlPipelineSnapshotPayload", () => {
  it("does not wipe margen_pre_ads from a prior Excel ingest on ML sync upsert", () => {
    const payload = buildMlPipelineSnapshotPayload({
      mlAccountId: "acc-1",
      snapshotDate: "2026-09-04",
      source: "api",
      prefill: {
        seller_id: "123",
        synced_at: "2026-09-04T11:00:00.000Z",
        data_sources: sources,
        gasto_ads: 1000,
        acos: 12
      },
      dataSources: sources,
      existing: { margen_pre_ads: 22.4, sistema_reposicion: 70 }
    });

    expect(payload.margen_pre_ads).toBe(22.4);
    expect(payload.sistema_reposicion).toBe(70);
    expect(payload.gasto_ads).toBe(1000);
    expect(payload.acos).toBe(12);
    expect(payload.ml_account_id).toBe("acc-1");
    expect(payload.snapshot_date).toBe("2026-09-04");
  });

  it("leaves margen_pre_ads null when no prior snapshot has it", () => {
    const payload = buildMlPipelineSnapshotPayload({
      mlAccountId: "acc-1",
      snapshotDate: "2026-09-04",
      source: "api",
      prefill: { seller_id: "123", synced_at: "t", data_sources: sources },
      dataSources: sources,
      existing: null
    });
    expect(payload.margen_pre_ads).toBeNull();
    expect(payload.sistema_reposicion).toBeNull();
  });
});
