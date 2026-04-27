"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function number(formData: FormData, key: string) {
  const value = text(formData, key).replace(/\./g, "").replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function planValue(formData: FormData): Database["public"]["Tables"]["pricing_proposals"]["Insert"]["plan"] {
  const value = text(formData, "plan");
  if (value === "starter" || value === "scale") return value;
  return "growth";
}

export async function savePricingProposal(formData: FormData) {
  const clientId = text(formData, "clientId");
  if (!clientId) {
    redirect("/operator/pricing?error=missing_client");
  }

  if (!isSupabaseConfigured()) {
    redirect(`/operator/pricing?saved=1&clientId=${clientId}`);
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") {
    redirect("/client/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const payload: Database["public"]["Tables"]["pricing_proposals"]["Insert"] = {
    client_id: clientId,
    created_by: profile.id,
    source: text(formData, "source") === "template" ? "template" : "manual",
    plan: planValue(formData),
    current_revenue: number(formData, "currentRevenue"),
    projected_revenue: number(formData, "projectedRevenue"),
    gross_margin_pct: number(formData, "grossMarginPct"),
    delivery_cost: number(formData, "deliveryCost"),
    setup_fee: number(formData, "setupFee"),
    months: Math.max(1, Math.round(number(formData, "months"))),
    fixed_fee: number(formData, "fixedFee"),
    variable_commission: number(formData, "variableCommission"),
    monthly_fee: number(formData, "monthlyFee"),
    operator_profit: number(formData, "operatorProfit"),
    operator_margin_pct: number(formData, "operatorMarginPct"),
    total_contract_value: number(formData, "totalContractValue"),
    payback_ratio: number(formData, "paybackRatio"),
    recommended: text(formData, "recommended") === "true",
    notes: text(formData, "notes") || null
  };

  const { error } = await supabase.from("pricing_proposals").insert(payload);
  if (error) {
    redirect(`/operator/pricing?error=save_failed&clientId=${clientId}`);
  }

  revalidatePath("/operator/pricing");
  redirect(`/operator/pricing?saved=1&clientId=${clientId}`);
}
