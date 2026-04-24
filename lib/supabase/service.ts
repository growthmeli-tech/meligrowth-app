import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createServiceSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseServiceConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
