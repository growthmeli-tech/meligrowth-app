/**
 * One-off diagnostic: GET /users/{sellerId} with stored OAuth token.
 * Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/ml-verify-user-reputation.ts
 *
 * Does not log access tokens. Pick account with ML_ACCOUNT_ID env or latest active ml_accounts row.
 */
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getValidAccessToken } from "@/lib/ml/auth";
import { mlFetch } from "@/lib/ml/client";

type MlUserDiagnostic = {
  id?: number;
  nickname?: string;
  seller_reputation?: unknown;
  status?: unknown;
  user_type?: string;
};

function pickSafePayload(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    nickname: raw.nickname,
    seller_reputation: raw.seller_reputation,
    status: raw.status,
    user_type: raw.user_type
  };
}

function diagnose(sr: unknown) {
  if (sr === undefined) {
    return {
      seller_reputation_key_present: false,
      seller_reputation_is_null: false,
      level_id_exists: false,
      power_seller_status_exists: false,
      note: "La respuesta no incluye la clave `seller_reputation` (undefined)."
    };
  }
  if (sr === null) {
    return {
      seller_reputation_key_present: true,
      seller_reputation_is_null: true,
      level_id_exists: false,
      power_seller_status_exists: false,
      note: "Mercado Libre devolvió `seller_reputation: null` (sin objeto de reputación para este usuario en esta respuesta)."
    };
  }
  if (typeof sr !== "object") {
    return {
      seller_reputation_key_present: true,
      seller_reputation_is_null: false,
      level_id_exists: false,
      power_seller_status_exists: false,
      note: `seller_reputation tiene tipo inesperado: ${typeof sr}`
    };
  }
  const o = sr as Record<string, unknown>;
  return {
    seller_reputation_key_present: true,
    seller_reputation_is_null: false,
    level_id_exists: "level_id" in o,
    power_seller_status_exists: "power_seller_status" in o,
    level_id_value: o.level_id ?? null,
    power_seller_status_value: o.power_seller_status ?? null,
    note:
      "level_id" in o && "power_seller_status" in o
        ? "El parser que usa `user.seller_reputation.level_id` / `power_seller_status` coincide con la forma de la API para esta respuesta."
        : "Revisar si ML usa otros nombres de campo dentro de seller_reputation para este caso."
  };
}

async function main() {
  const supabase = createServiceSupabaseClient();
  const explicitId = process.env.ML_ACCOUNT_ID?.trim();

  let mlAccountId: string | null = explicitId || null;
  let sellerId: string | null = null;
  let accountName: string | null = null;

  if (mlAccountId) {
    const { data: row, error } = await supabase
      .from("ml_accounts")
      .select("id, seller_id, account_name")
      .eq("id", mlAccountId)
      .maybeSingle();
    if (error || !row) {
      console.error("ml_accounts lookup failed", error?.message ?? "not found");
      process.exit(1);
    }
    sellerId = row.seller_id;
    accountName = row.account_name;
  } else {
    const { data: rows, error } = await supabase
      .from("ml_accounts")
      .select("id, seller_id, account_name")
      .eq("active", true)
      .not("seller_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error || !rows?.length) {
      console.error("No active ml_accounts with seller_id. Set ML_ACCOUNT_ID or connect an account.");
      process.exit(1);
    }
    mlAccountId = rows[0].id;
    sellerId = rows[0].seller_id;
    accountName = rows[0].account_name;
  }

  if (!sellerId || !mlAccountId) {
    console.error("Missing seller_id on ml_accounts row.");
    process.exit(1);
  }

  console.info("[ml-verify-user] context", {
    ml_account_id: mlAccountId,
    account_name: accountName,
    seller_id: sellerId
  });

  const accessToken = await getValidAccessToken("", mlAccountId);

  const raw = await mlFetch<Record<string, unknown>>(`/users/${sellerId}`, {
    token: accessToken
  });

  const safe = pickSafePayload(raw);
  const sr = raw.seller_reputation;
  const diagnosis = diagnose(sr);

  console.info("[ml-verify-user] sanitized_payload", JSON.stringify(safe, null, 2));
  console.info("[ml-verify-user] diagnosis", diagnosis);

  // Parser alignment (same as lib/ml/endpoints/users.ts)
  const parsedLikeProd =
    sr && typeof sr === "object"
      ? {
          level_id: (sr as { level_id?: unknown }).level_id ?? null,
          power_seller_status: (sr as { power_seller_status?: unknown }).power_seller_status ?? null
        }
      : null;

  console.info("[ml-verify-user] parser_equivalent_to_users_ts", parsedLikeProd);
}

main().catch((e) => {
  console.error("[ml-verify-user] fatal", e instanceof Error ? e.message : e);
  process.exit(1);
});
