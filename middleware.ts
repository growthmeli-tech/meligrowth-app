import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

const INTERNAL_ROLES: UserRoleV2[] = ["super_admin_meli_growth", "internal_operator_meli_growth"];
type OperatorAccessRow = { ops_access_enabled?: boolean | null };

function getHomeForRole(role: UserRoleV2, operatorHasOpsAccess = true) {
  if (INTERNAL_ROLES.includes(role)) return "/internal/dashboard";
  if (role === "client_manager" || (role === "client_operator" && !operatorHasOpsAccess)) return "/brand/dashboard";
  return "/ops/dashboard";
}

function getRequiredScope(pathname: string): "internal" | "brand" | "ops" | "client" | null {
  if (pathname.startsWith("/internal") || pathname.startsWith("/operator")) return "internal";
  if (pathname.startsWith("/brand")) return "brand";
  if (pathname.startsWith("/ops")) return "ops";
  if (pathname.startsWith("/client")) return "client";
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("users_v2").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role as UserRoleV2 | undefined;

  if (!role) {
    return NextResponse.redirect(new URL("/login?error=missing_role", request.url));
  }

  let operatorHasOpsAccess = true;
  if (role === "client_operator") {
    const { data: operatorAccess } = await supabase
      .from("user_account_access")
      .select("ops_access_enabled")
      .eq("user_id", user.id)
      .eq("access_type", "operator")
      .eq("ops_access_enabled", true)
      .maybeSingle();

    operatorHasOpsAccess = Boolean((operatorAccess as OperatorAccessRow | null)?.ops_access_enabled === true);
  }

  if (pathname.startsWith("/operator")) {
    return NextResponse.redirect(new URL(pathname.replace("/operator", "/internal"), request.url));
  }

  if (pathname.startsWith("/client")) {
    return NextResponse.redirect(new URL(getHomeForRole(role, operatorHasOpsAccess), request.url));
  }

  const requiredScope = getRequiredScope(pathname);

  if (requiredScope === "internal" && !INTERNAL_ROLES.includes(role)) {
    return NextResponse.redirect(new URL(getHomeForRole(role, operatorHasOpsAccess), request.url));
  }

  if (requiredScope === "brand") {
    const canAccessBrand = role === "client_manager" || (role === "client_operator" && !operatorHasOpsAccess);
    if (!canAccessBrand) {
      return NextResponse.redirect(new URL(getHomeForRole(role, operatorHasOpsAccess), request.url));
    }
  }

  if (requiredScope === "ops" && (role !== "client_operator" || !operatorHasOpsAccess)) {
    if (role === "client_operator") {
      return NextResponse.redirect(new URL("/brand/dashboard", request.url));
    }
    return NextResponse.redirect(new URL(getHomeForRole(role, operatorHasOpsAccess), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/internal/:path*", "/brand/:path*", "/ops/:path*", "/operator/:path*", "/client/:path*"]
};
