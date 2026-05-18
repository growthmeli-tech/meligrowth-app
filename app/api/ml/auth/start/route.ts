import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/ml/auth";
import { createMlOAuthState } from "@/lib/ml/oauth-state";
import { requireMeliGrowthTeam } from "@/lib/data-v2/internal-team";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient as createServiceClient } from "@/lib/supabase/service";
import { getInviteByRawToken, sessionEmailMatchesInvite } from "@/lib/ml/invite-lookup";

function loginRedirect(request: NextRequest, destinationPath: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", destinationPath.startsWith("/") ? destinationPath : `/${destinationPath}`);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  const inviteToken = request.nextUrl.searchParams.get("invite_token")?.trim() ?? "";
  const reconnectMlAccountId = request.nextUrl.searchParams.get("ml_account_id")?.trim() ?? "";

  if (inviteToken) {
    if (authError || !user) {
      const back = `/connect/ml?token=${encodeURIComponent(inviteToken)}`;
      return loginRedirect(request, back);
    }

    const invite = await getInviteByRawToken(inviteToken);
    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "invalid_or_expired_invite" }, { status: 400 });
    }
    if (invite.isConnected) {
      return NextResponse.json({ error: "invite_already_connected" }, { status: 400 });
    }
    if (!sessionEmailMatchesInvite(user.email ?? undefined, invite.clientEmail)) {
      return NextResponse.json({ error: "invite_email_mismatch" }, { status: 403 });
    }

    const service = createServiceClient();
    const { data: account, error: accErr } = await service
      .from("ml_accounts")
      .select("id, seller_id, company_id")
      .eq("id", invite.mlAccountId)
      .maybeSingle();
    if (accErr || !account || account.seller_id) {
      return NextResponse.json({ error: "invalid_ml_account" }, { status: 400 });
    }

    const state = await createMlOAuthState(invite.mlAccountId, { inviteId: invite.id });
    return NextResponse.redirect(getAuthorizationUrl(state));
  }

  const internalGate = await requireMeliGrowthTeam();
  if (!internalGate.success) {
    return NextResponse.json({ error: internalGate.error ?? "forbidden" }, { status: 403 });
  }

  if (!user) {
    return loginRedirect(request, "/internal/dashboard");
  }

  if (!reconnectMlAccountId) {
    return NextResponse.json(
      { error: "missing_ml_account_id", hint: "Internal reconnect requires ml_account_id query param." },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: account, error: accountError } = await service
    .from("ml_accounts")
    .select("id, company_id")
    .eq("id", reconnectMlAccountId)
    .maybeSingle();
  if (accountError || !account) {
    return NextResponse.json({ error: "invalid_ml_account_id" }, { status: 400 });
  }

  const state = await createMlOAuthState(reconnectMlAccountId);
  return NextResponse.redirect(getAuthorizationUrl(state));
}
