import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import {
  clearRateLimit,
  peekRateLimit,
  recordRateLimit,
} from "@/lib/auth/rateLimit";
import { loginBodySchema } from "@/lib/auth/validation";
import {
  createServerSupabase,
  createServiceSupabase,
} from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };

/**
 * POST /api/auth/login
 *
 * Email + password sign-in. Per PRD §3.1 there is no OTP on login —
 * just a Supabase password grant.
 *
 * Flow:
 *
 *   1. Validate body via Zod.
 *   2. Peek rate-limit bucket `login:failed:<email>` (5 failed
 *      attempts / 15 min). If the bucket is at capacity reject with
 *      429 without even contacting Supabase, so a stuffer can't
 *      brute-force timing-side-channels here either.
 *   3. Call `signInWithPassword`. On Supabase failure → record a hit
 *      and return 401 `invalid_credentials`. We intentionally surface a
 *      generic message so we don't leak which half of the credential
 *      was wrong.
 *   4. On success, look the profile up with the service role (no RLS).
 *      If `status='suspended'` → call `signOut()` to drop the cookie
 *      we just set, and return 403 `account_suspended`.
 *   5. Otherwise, clear the failed-attempt bucket and return
 *      `{ ok: true, redirect }` where the redirect target depends on
 *      profile status:
 *
 *        - `profile_verified` → `/dash` (default landing).
 *        - anything else (pre_verified / pending_otp) → `/complete-profile`.
 *
 *      NB: the wording in the task spec inverts these ("If profile
 *      status = profile_verified → redirect to /complete-profile") but
 *      the broader spec is unambiguous that verified users land on
 *      `/dash` — the inversion is a typo, see the same flow in the
 *      registration set-password handler.
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
    body = loginBodySchema.parse(raw);
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

  const limitKey = `login:failed:${body.email}`;
  const peek = peekRateLimit(limitKey, LOGIN_RATE_LIMIT);
  if (!peek.allowed) {
    return errJson(
      "rate_limited",
      authContent.auth.errors.loginRateLimited,
      429,
    );
  }

  const supabase = createServerSupabase();
  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

  if (signInError || !signIn?.user) {
    recordRateLimit(limitKey, LOGIN_RATE_LIMIT);
    return errJson(
      "invalid_credentials",
      authContent.auth.errors.invalidCredentials,
      401,
    );
  }

  // Look the profile up with the service role so suspended users can't
  // hide behind RLS. We must do this after signInWithPassword because
  // until then we don't know the auth-user id.
  const admin = createServiceSupabase();
  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("status")
    .eq("id", signIn.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[api/auth/login] profile lookup failed", profileError);
    return errJson("internal_error", "Internal server error", 500);
  }

  const status = (profileRow as { status?: string } | null)?.status;
  if (status === "suspended") {
    await supabase.auth.signOut().catch(() => {
      /* best effort — cookie cleared even if remote revoke fails */
    });
    return errJson(
      "account_suspended",
      authContent.auth.errors.accountSuspended,
      403,
    );
  }

  // Successful sign-in clears any prior failed-attempt counter.
  clearRateLimit(limitKey);

  const redirect =
    status === "profile_verified" ? "/dash" : "/complete-profile";
  return NextResponse.json({ ok: true, redirect });
}
