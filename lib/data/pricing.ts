import { redirect } from "next/navigation";
import { DEFAULT_PRICING_HISTORY_LIMIT } from "@/lib/config/constants";
import { getCurrentProfile } from "@/lib/data/clients";
import { pricingProposals as mockPricingProposals } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { PricingProposal } from "@/lib/types";

type PricingProposalRow = Database["public"]["Tables"]["pricing_proposals"]["Row"];

const numberOrZero = (value: number | null) => Number(value ?? 0);

function mapPricingProposal(row: PricingProposalRow, clientName: string): PricingProposal {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName,
    createdBy: row.created_by ?? undefined,
    source: row.source,
    plan: row.plan,
    currentRevenue: numberOrZero(row.current_revenue),
    projectedRevenue: numberOrZero(row.projected_revenue),
    grossMarginPct: numberOrZero(row.gross_margin_pct),
    deliveryCost: numberOrZero(row.delivery_cost),
    setupFee: numberOrZero(row.setup_fee),
    months: row.months,
    fixedFee: numberOrZero(row.fixed_fee),
    variableCommission: numberOrZero(row.variable_commission),
    monthlyFee: numberOrZero(row.monthly_fee),
    operatorProfit: numberOrZero(row.operator_profit),
    operatorMarginPct: numberOrZero(row.operator_margin_pct),
    totalContractValue: numberOrZero(row.total_contract_value),
    paybackRatio: numberOrZero(row.payback_ratio),
    recommended: row.recommended,
    notes: row.notes ?? undefined,
    createdAt: row.created_at
  };
}

export async function getPricingProposalHistory(limit = DEFAULT_PRICING_HISTORY_LIMIT) {
  if (!isSupabaseConfigured()) return mockPricingProposals.slice(0, limit);

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("pricing_proposals")
    .select(
      "id, client_id, created_by, source, plan, current_revenue, projected_revenue, gross_margin_pct, delivery_cost, setup_fee, months, fixed_fee, variable_commission, monthly_fee, operator_profit, operator_margin_pct, total_contract_value, payback_ratio, recommended, notes, created_at, clients(name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<PricingProposalRow & { clients?: { name?: string } | null }>).map((row) =>
    mapPricingProposal(row, row.clients?.name ?? "Cliente")
  );
}
