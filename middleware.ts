import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import type { UserRoleV2 } from "@/lib/types/enums";

const INTERNAL_ROLES: UserRoleV2[] = ["super_admin_meli_growth", "internal_operator_meli_growth"];

function getHomeForRole(role: UserRoleV2) {
  if (INTERNAL_ROLES.includes(role)) return "/internal/dashboard";
  if (role === "client_manager") return "/brand/dashboard";
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

  if (pathname.startsWith("/operator")) {
    return NextResponse.redirect(new URL(pathname.replace("/operator", "/internal"), request.url));
  }

  if (pathname.startsWith("/client")) {
    return NextResponse.redirect(new URL(getHomeForRole(role), request.url));
  }

  const requiredScope = getRequiredScope(pathname);

  if (requiredScope === "internal" && !INTERNAL_ROLES.includes(role)) {
    return NextResponse.redirect(new URL(getHomeForRole(role), request.url));
  }

  if (requiredScope === "brand" && role !== "client_manager") {
    return NextResponse.redirect(new URL(getHomeForRole(role), request.url));
  }

  if (requiredScope === "ops" && role !== "client_operator") {
    return NextResponse.redirect(new URL(getHomeForRole(role), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/internal/:path*", "/brand/:path*", "/ops/:path*", "/operator/:path*", "/client/:path*"]
};
