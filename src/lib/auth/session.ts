import "server-only";

import type { User } from "@supabase/supabase-js";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

/**
 * Server-side session helpers used by route handlers, server actions and
 * RSC layouts. The middleware refreshes the Supabase access token before
 * any of these functions runs, so by the time `getCurrentUser()` is
 * called the cookie is up to date.
 *
 * Profile lookup is cached for the lifetime of a single request via the
 * Supabase server client (which itself uses Next's request-scoped
 * `cookies()` store), so calling `requireUser()` and then
 * `requireAdmin()` in the same handler does not re-hit the database.
 */

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface AuthContext {
  user: User;
  profile: ProfileRow;
}

export class UnauthorizedError extends Error {
  public readonly status = 401;
  public readonly code = "unauthenticated";
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ProfileIncompleteError extends Error {
  public readonly status = 403;
  public readonly code = "profile_incomplete";
  public readonly redirectTo = "/complete-profile";
  constructor(message = "Profile is not yet verified") {
    super(message);
    this.name = "ProfileIncompleteError";
  }
}

export class ForbiddenError extends Error {
  public readonly status = 403;
  public readonly code = "forbidden";
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Returns `{ user, profile }` if a valid session cookie is present and a
 * matching `profiles` row exists, otherwise `null`. Never throws.
 */
export async function getCurrentUser(): Promise<AuthContext | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !data) return null;
  const profile = data as ProfileRow;

  return { user, profile };
}

/** Returns `{ user, profile }`. Throws `UnauthorizedError` if no session. */
export async function requireUser(): Promise<AuthContext> {
  const ctx = await getCurrentUser();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/**
 * Like `requireUser()` but additionally insists the profile has been
 * fully verified (`status = 'profile_verified'`). Used by the (user)
 * route group to bounce half-onboarded users to `/complete-profile`.
 */
export async function requireProfileVerified(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.profile.status !== "profile_verified") {
    throw new ProfileIncompleteError();
  }
  return ctx;
}

/** Like `requireUser()` but also requires `profile.is_admin = true`. */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!ctx.profile.is_admin) throw new ForbiddenError();
  return ctx;
}

/**
 * Asserts the current user either owns `record` (matching `user_id`) or
 * is an admin. Throws `UnauthorizedError` if not signed in,
 * `ForbiddenError` if signed in but neither owner nor admin.
 */
export async function requireOwnership<T extends { user_id: string }>(
  record: T,
): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.profile.is_admin) return ctx;
  if (record.user_id !== ctx.user.id) throw new ForbiddenError();
  return ctx;
}
