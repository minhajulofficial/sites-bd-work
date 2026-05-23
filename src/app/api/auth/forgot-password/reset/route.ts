import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { verifyPasswordResetToken } from "@/lib/auth/passwordResetToken";
import { forgotPasswordResetBodySchema } from "@/lib/auth/validation";
import { createServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password/reset
 *
 * Final step of the forgot-password wizard. Given a valid reset token
 * (issued by `verify-otp`), looks up the auth user by email, updates
 * their password through the Supabase admin API, then invalidates all
 * existing sessions globally so any device still holding a refresh
 * token from the old password has to re-authenticate.
 *
 * Flow:
 *
 *   1. Validate the body via Zod.
 *   2. Verify the reset-token signature + expiry. On any failure the
 *      caller has to restart the wizard.
 *   3. Resolve the verified `email` from the token's payload, look up
 *      the `auth.users` row by email. If somehow no user exists (the
 *      profile was deleted between OTP verification and reset) return
 *      400 — we never want to silently succeed against a missing
 *      account.
 *   4. Call `admin.auth.admin.updateUserById(userId, { password })`
 *      with the service role to set the new password.
 *   5. Globally sign the user out of every active session by hitting
 *      the GoTrue admin endpoint
 *      `POST /auth/v1/admin/users/{id}/logout?scope=global`. The
 *      `supabase-js` client does not expose a `signOutUser(uid)`
 *      helper — `admin.signOut(jwt)` only revokes a specific session —
 *      so we issue the request directly.
 *   6. Return `{ ok: true, redirect: '/login' }`.
 *
 * Local response cookies are not modified: the `/forgot-password` page
 * is in the (auth) middleware group, so any signed-in user landing on
 * it has already been bounced to `/dash`. Anonymous resetters have no
 * session cookie to clear here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errJson("invalid_body", "Body must be valid JSON", 400);
  }

  let body;
  try {
    body = forgotPasswordResetBodySchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return errJson(
        "invalid_body",
        e.issues[0]?.message ?? "Invalid request body",
        400,
      );
    }
    throw e;
  }

  const tokenResult = verifyPasswordResetToken(body.token);
  if (!tokenResult.ok) {
    const message =
      tokenResult.reason === "expired"
        ? "Reset session expired. Please restart the password reset."
        : "Invalid reset session. Please restart the password reset.";
    return errJson(`token_${tokenResult.reason}`, message, 400);
  }

  const { email } = tokenResult.payload;
  const admin = createServiceSupabase();

  // Resolve the auth-user id by email. `profiles.id` mirrors
  // `auth.users.id` (set during PR-05 set-password), so reading the
  // profiles table avoids paginating `auth.admin.listUsers`.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profileErr) {
    console.error(
      "[api/forgot-password/reset] profile lookup failed",
      profileErr,
    );
    return errJson("internal_error", "Internal server error", 500);
  }
  if (!profile) {
    return errJson(
      "user_not_found",
      "We could not find an account for this email. Please restart the password reset.",
      400,
    );
  }
  const userId = (profile as { id: string }).id;

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password: body.password,
  });
  if (updateErr) {
    console.error(
      "[api/forgot-password/reset] updateUserById failed",
      updateErr,
    );
    return errJson(
      "internal_error",
      "Could not update your password. Please try again.",
      500,
    );
  }

  try {
    await signOutAllSessions(userId);
  } catch (err) {
    // The acceptance criterion requires existing sessions be
    // invalidated; surface a hard failure to the user so they don't
    // think the reset succeeded silently. The password was already
    // updated above, so the user can still sign in — they just need
    // to know not to trust any other open sessions.
    console.error(
      "[api/forgot-password/reset] global signOut failed",
      err,
    );
    return errJson(
      "session_invalidation_failed",
      "Password was updated but we could not revoke other sessions. Please sign in and sign out of any other devices.",
      500,
    );
  }

  return NextResponse.json({ ok: true, redirect: "/login" });
}

/**
 * Calls the GoTrue admin "log out user globally" endpoint, which
 * revokes every refresh token across every device for `userId`.
 */
async function signOutAllSessions(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[api/forgot-password/reset] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  const endpoint = `${url.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}/logout?scope=global`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GoTrue admin logout returned ${res.status} ${res.statusText}: ${text}`,
    );
  }
}
