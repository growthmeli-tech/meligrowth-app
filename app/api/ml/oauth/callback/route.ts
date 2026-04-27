import { NextRequest, NextResponse } from "next/server";

// Canonical callback route is /api/ml/auth/callback.
// Keep this alias to avoid OAuth failures if an older redirect URI is still configured.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  console.info("[ml-oauth-callback-alias] redirecting_to_auth_callback", {
    originalPath: url.pathname,
    query: url.search
  });
  url.pathname = "/api/ml/auth/callback";
  return NextResponse.redirect(url);
}
