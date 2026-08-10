/**
 * Session-refresh helper for Next.js middleware. Keeps the Supabase auth cookies
 * fresh and gates /dashboard behind authentication.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// All current API routes are private. A future webhook/auth endpoint must be
// deliberately added here rather than being made public by a broad matcher.
const PUBLIC_API_PREFIXES: readonly string[] = [];

function isProtectedApi(path: string): boolean {
  return path.startsWith("/api/") && !PUBLIC_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function accountBlockedResponse(status?: string) {
  return NextResponse.json(
    {
      error: status ? "Account is not active" : "Account unavailable",
      code: status ? `account_${status}` : "account_unavailable",
    },
    { status: 403 }
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase isn't configured yet, don't block the app.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Let route handlers produce their normal 401 for anonymous requests. For a
  // retained authenticated session, every private API also requires a present,
  // readable, active profile.
  if (user && isProtectedApi(path)) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) return accountBlockedResponse();
    if (profile.account_status !== "active") {
      return accountBlockedResponse(profile.account_status as string);
    }
  }

  // Gate dashboard + admin routes behind auth. The dashboard and admin guards
  // perform the fail-closed profile/status checks needed for page rendering.
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
