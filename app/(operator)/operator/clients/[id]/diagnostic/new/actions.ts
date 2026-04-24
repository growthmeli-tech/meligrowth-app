"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistDiagnostic } from "@/lib/diagnostics/persist-diagnostic";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DiagnosticInput } from "@/lib/types";

function numberFromForm(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

function inputFromForm(formData: FormData): DiagnosticInput {
  return {
    salud: {
      reclamos: numberFromForm(formData, "reclamos"),
      mediaciones: numberFromForm(formData, "mediaciones"),
      cancelaciones_vendedor: numberFromForm(formData, "cancelaciones_vendedor"),
      envios_a_tiempo: numberFromForm(formData, "envios_a_tiempo")
    },
    publicaciones: {
      pubs_activas_pct: numberFromForm(formData, "pubs_activas_pct"),
      pubs_optimizadas_pct: numberFromForm(formData, "pubs_optimizadas_pct"),
      ctr: numberFromForm(formData, "ctr")
    },
    ads: {
      margen_pre_ads: numberFromForm(formData, "margen_pre_ads"),
      gasto_ads: numberFromForm(formData, "gasto_ads"),
      ventas_ads: numberFromForm(formData, "ventas_ads"),
      ventas_totales: numberFromForm(formData, "ventas_totales"),
      acos: numberFromForm(formData, "acos"),
      roas: numberFromForm(formData, "roas"),
      tacos: numberFromForm(formData, "tacos")
    },
    logistica: {
      incidencias_pct: numberFromForm(formData, "incidencias_pct"),
      uso_full_flex_pct: numberFromForm(formData, "uso_full_flex_pct"),
      cancelaciones_stock_pct: numberFromForm(formData, "cancelaciones_stock_pct")
    },
    stock: {
      skus_sin_stock_pct: numberFromForm(formData, "skus_sin_stock_pct"),
      dias_stock: numberFromForm(formData, "dias_stock"),
      lead_time_reposicion: numberFromForm(formData, "lead_time_reposicion"),
      sistema_reposicion: numberFromForm(formData, "sistema_reposicion")
    }
  };
}

export async function createDiagnostic(clientId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(`/operator/clients/${clientId}?tab=diagnostico`);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const input = inputFromForm(formData);
  const date = String(formData.get("date") || new Date().toISOString().slice(0, 10));

  const result = await persistDiagnostic({
    supabase,
    clientId,
    input,
    date,
    source: "manual",
    createdBy: user.id
  });

  if (!result.ok) {
    redirect(`/operator/clients/${clientId}/diagnostic/new?error=save`);
  }

  revalidatePath("/operator/dashboard");
  revalidatePath(`/operator/clients/${clientId}`);
  revalidatePath("/operator/notifications");
  revalidatePath("/client/dashboard");
  revalidatePath("/client/metrics");
  redirect(`/operator/clients/${clientId}?tab=diagnostico`);
}
