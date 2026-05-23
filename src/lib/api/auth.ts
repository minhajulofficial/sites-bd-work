import { createServerSupabase } from "@/lib/supabase/server";

import { errJson } from "./responses";

import type { NextResponse } from "next/server";

export type AuthOk = {
  ok: true;
  userId: string;
  isAdmin: boolean;
};

export type AuthFail = {
  ok: false;
  response: NextResponse;
};

export type AuthResult = AuthOk | AuthFail;

/**
 * Resolves the current Supabase user (via the `auth` cookie wired up by
 * `createServerSupabase`) and looks up the matching `profiles.is_admin`
 * flag. Returns a structured result so callers can short-circuit on
 * `ok: false` and return `result.response` directly.
 *
 * On any auth failure the response uses `401 unauthenticated`. The
 * is_admin lookup is best-effort — if the profile row hasn't been
 * provisioned yet (e.g. mid-signup), `isAdmin` defaults to `false`
 * rather than erroring.
 */
export async function authenticate(): Promise<AuthResult> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return {
      ok: false,
      response: errJson(
        "unauthenticated",
        "You must be signed in",
        401,
      ),
    };
  }

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { is_admin?: boolean | null } | null;

  return {
    ok: true,
    userId: user.id,
    isAdmin: !!profile?.is_admin,
  };
}

/** Requires a signed-in user. Returns 401 envelope when unauthenticated. */
export async function requireAuthenticated(): Promise<AuthResult> {
  return authenticate();
}

/**
 * Requires a signed-in user with `profiles.is_admin = true`. Returns 401
 * if unauthenticated, 403 if authenticated but not admin.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await authenticate();
  if (!result.ok) return result;
  if (!result.isAdmin) {
    return {
      ok: false,
      response: errJson("forbidden", "Admin role required", 403),
    };
  }
  return result;
}
