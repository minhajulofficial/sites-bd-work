import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Auth middleware.
 *
 * Runs on every request that matches the matcher below and:
 *
 *   1. Refreshes the Supabase access-token cookie (per Supabase SSR
 *      docs) so subsequent server-side `getUser()` / `requireUser()`
 *      calls see a current session.
 *
 *   2. Applies route-group guards:
 *      - `(user)` pages (`/dash*`, `/domains*`, `/services*`, `/cart*`,
 *        `/invoices*`, `/tickets*`) require an authenticated user.
 *        Anonymous → `/login`. Authenticated-but-half-onboarded
 *        (`status != 'profile_verified'`) → `/complete-profile`.
 *      - `/admin*` requires an authenticated admin (`is_admin = true`).
 *        Anonymous → `/login`. Logged-in non-admin → `/dash`.
 *      - `/login`, `/register`, `/forgot-password` redirect already
 *        signed-in & verified users to `/dash`.
 *      - `/`, `/check`, `/api/*` (and everything else) is allowed
 *        through. API route handlers are still individually
 *        responsible for re-asserting auth at the route level.
 *
 * The profile lookup is performed at most once per request (it's
 * skipped entirely on public routes and on routes that don't need
 * verification status), and uses the same anon-key client as the rest
 * of the app — i.e. it respects RLS and only ever sees the caller's
 * own row.
 */

const USER_GROUP_PREFIXES = [
  "/dash",
  "/domains",
  "/services",
  "/cart",
  "/invoices",
  "/tickets",
] as const;

const ADMIN_GROUP_PREFIX = "/admin";

const AUTH_GROUP_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
]);

const COMPLETE_PROFILE_PATH = "/complete-profile";
const DEFAULT_USER_LANDING = "/dash";
const DEFAULT_LOGIN_PATH = "/login";

function isUserGroupPath(pathname: string): boolean {
  return USER_GROUP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAdminGroupPath(pathname: string): boolean {
  return (
    pathname === ADMIN_GROUP_PREFIX ||
    pathname.startsWith(`${ADMIN_GROUP_PREFIX}/`)
  );
}

function isAuthGroupPath(pathname: string): boolean {
  return AUTH_GROUP_PATHS.has(pathname);
}

export async function middleware(request: NextRequest) {
  // Start with the canonical pass-through response. The Supabase
  // cookie helpers below mutate this response's cookies in place so
  // the refreshed session flows back to the browser.
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Without Supabase wired up we can't enforce auth; let the request
    // through so the rest of the app still renders (the route handlers
    // themselves will surface a clearer error).
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // This call is what actually refreshes the access token; the cookie
  // helpers above persist the new cookie to `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes (no auth checks). We still ran the refresh above so
  // the session stays alive across navigations.
  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/check" ||
    pathname.startsWith("/check/")
  ) {
    return response;
  }

  // (auth) group — bounce signed-in+verified users straight to /dash.
  if (isAuthGroupPath(pathname)) {
    if (!user) return response;
    const profile = await fetchProfile(supabase, user.id);
    if (profile && profile.status === "profile_verified") {
      return redirectTo(request, DEFAULT_USER_LANDING);
    }
    return response;
  }

  // /complete-profile is itself reachable only by an authenticated user
  // whose profile is not yet verified.
  if (pathname === COMPLETE_PROFILE_PATH) {
    if (!user) return redirectTo(request, DEFAULT_LOGIN_PATH);
    const profile = await fetchProfile(supabase, user.id);
    if (profile && profile.status === "profile_verified") {
      return redirectTo(request, DEFAULT_USER_LANDING);
    }
    return response;
  }

  // Admin group.
  if (isAdminGroupPath(pathname)) {
    if (!user) return redirectTo(request, DEFAULT_LOGIN_PATH);
    const profile = await fetchProfile(supabase, user.id);
    if (!profile || !profile.is_admin) {
      return redirectTo(request, DEFAULT_USER_LANDING);
    }
    return response;
  }

  // User group.
  if (isUserGroupPath(pathname)) {
    if (!user) return redirectTo(request, DEFAULT_LOGIN_PATH);
    const profile = await fetchProfile(supabase, user.id);
    if (!profile) return redirectTo(request, DEFAULT_LOGIN_PATH);
    if (profile.status !== "profile_verified") {
      return redirectTo(request, COMPLETE_PROFILE_PATH);
    }
    return response;
  }

  return response;
}

interface MinimalProfile {
  status: string;
  is_admin: boolean;
}

async function fetchProfile(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<MinimalProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("status, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MinimalProfile;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on everything except Next internals + the static assets that
    // never need auth refresh.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
