import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  })
}));
vi.mock("@/lib/data", () => ({
  getCurrentProfile: vi.fn()
}));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn()
}));

import { createClientAction } from "@/app/(internal)/internal/clients/[id]/actions";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function createClientSupabaseMock(insertError: { message: string; code: string } | null = null) {
  const clientsBuilder = {
    select: vi.fn(() => clientsBuilder),
    eq: vi.fn(() => clientsBuilder),
    single: vi.fn(async () => ({ data: { id: "client-1" }, error: null }))
  };

  const actionsBuilder = {
    insert: vi.fn(async () => ({ data: null, error: insertError }))
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "clients") return clientsBuilder;
      if (table === "actions") return actionsBuilder;
      return actionsBuilder;
    })
  };
}

function buildFormData() {
  const formData = new FormData();
  formData.set("titulo", "Corregir ACOS");
  formData.set("descripcion", "Bajar bids no rentables");
  formData.set("bloque", "ads");
  formData.set("prioridad", "alta");
  formData.set("due_date", "2026-05-03");
  return formData;
}

describe("Server action createClientAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentProfile).mockResolvedValue({
      id: "user-operator-1",
      role: "operator"
    } as never);
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createServerSupabaseClient).mockResolvedValue(createClientSupabaseMock() as never);
  });

  it("crea accion para un cliente del operator", async () => {
    const result = await createClientAction("client-1", buildFormData());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created).toBe(true);
    }
  });

  it("falla con error de validacion cuando falta titulo", async () => {
    const formData = buildFormData();
    formData.set("titulo", "");
    const result = await createClientAction("client-1", formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("retorna error cuando supabase devuelve falla al insertar", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      createClientSupabaseMock({ message: "RLS violation", code: "42501" }) as never
    );

    const result = await createClientAction("client-1", buildFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("42501");
    }
  });
});
