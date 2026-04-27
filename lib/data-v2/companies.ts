import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/types/api";
import { formatSupabaseError, isPostgresError, logServerError } from "@/lib/utils/errors";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

const COMPANY_SELECT = "id, name, slug, plan, active, created_at, updated_at";

export async function listCompanies(options?: {
  activeOnly?: boolean;
  limit?: number;
}): Promise<ActionResult<CompanyRow[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("companies").select(COMPANY_SELECT).order("name");

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("data-v2.listCompanies", error, options);
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar companies",
      code: error.code
    };
  }

  return { success: true, data: (data ?? []) as CompanyRow[] };
}

export async function getCompanyById(companyId: string): Promise<ActionResult<CompanyRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("companies").select(COMPANY_SELECT).eq("id", companyId).maybeSingle();

  if (error) {
    logServerError("data-v2.getCompanyById", error, { companyId });
    return {
      success: false,
      error: isPostgresError(error) ? formatSupabaseError(error) : "No se pudo cargar la company",
      code: error.code
    };
  }

  return { success: true, data: (data as CompanyRow | null) ?? null };
}
