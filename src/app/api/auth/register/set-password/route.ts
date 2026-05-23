import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { verifyRegistrationToken } from "@/lib/auth/registrationToken";
import { setPasswordBodySchema } from "@/lib/auth/validation";
import {
  createServerSupabase,
  createServiceSupabase,
} from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register/set-password
 *
 * Final server step before profile completion. Given a valid
 * registration token (issued by `verify-otp`):
 *
 *   1. Resolve the verified `email` from the token. Reject with 400 if
 *      the signature is bad, the payload is malformed, or the token
 *      has expired (30 min TTL).
 *   2. Create the `auth.users` row via the Supabase admin API with
 *      `email_confirmed=true` (we already verified the email via OTP).
 *   3. Insert the matching `profiles` row in `pre_verified` state.
 *      Profile completion (step 4) flips it to `profile_verified`.
 *
 *      Note on `profiles.mobile`: the column is `text unique not null`
 *      per `0001_init.sql`, but the PRD requires the mobile to be
 *      collected in the *next* step. We seed it with a placeholder of
 *      the form `pending:<auth_user_id>` (guaranteed unique, will never
 *      match the BD-mobile regex) and overwrite it during
 *      `complete-profile`. The DB immutability trigger only fires once
 *      status reaches `profile_verified`, so this swap is allowed.
 *   4. Sign the user in by issuing a Supabase password-grant session;
 *      `@supabase/ssr` writes the access/refresh cookies onto the
 *      response.
 *
 * On any partial-failure (auth user created but profile insert fails)
 * we best-effort delete the auth user so the email can be retried.
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
    body = setPasswordBodySchema.parse(raw);
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

  const tokenResult = verifyRegistrationToken(body.token);
  if (!tokenResult.ok) {
    const message =
      tokenResult.reason === "expired"
        ? "Verification session expired. Please restart registration."
        : "Invalid verification session. Please restart registration.";
    return errJson(`token_${tokenResult.reason}`, message, 400);
  }

  const { email } = tokenResult.payload;
  const admin = createServiceSupabase();

  // Belt + braces: re-check that the email isn't fully registered
  // between OTP verification and password setup. If the token outlived
  // a parallel registration that completed, surface the conflict
  // instead of attempting `createUser` and getting a Supabase-level
  // 422.
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("status")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error(
      "[api/register/set-password] profile lookup failed",
      lookupError,
    );
    return errJson("internal_error", "Internal server error", 500);
  }
  if (
    existing &&
    (existing as { status: string }).status === "profile_verified"
  ) {
    return errJson(
      "email_taken",
      authContent.auth.errors.emailTaken,
      409,
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password: body.password,
      email_confirm: true,
    },
  );
  if (createErr || !created?.user) {
    console.error(
      "[api/register/set-password] supabase admin.createUser failed",
      createErr,
    );
    const message = createErr?.message?.toLowerCase().includes("already")
      ? authContent.auth.errors.emailTaken
      : "Could not create your account. Please try again.";
    const status = createErr?.message?.toLowerCase().includes("already")
      ? 409
      : 500;
    return errJson(
      status === 409 ? "email_taken" : "internal_error",
      message,
      status,
    );
  }

  const authUserId = created.user.id;
  const placeholderMobile = `pending:${authUserId}`;

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUserId,
    email,
    mobile: placeholderMobile,
    status: "pre_verified",
    is_admin: false,
  });
  if (profileError) {
    console.error(
      "[api/register/set-password] profiles insert failed",
      profileError,
    );
    await admin.auth.admin.deleteUser(authUserId).catch((err) => {
      console.error(
        "[api/register/set-password] best-effort auth user cleanup failed",
        err,
      );
    });
    return errJson("internal_error", "Could not finish account setup", 500);
  }

  // Sign the user in using their just-set password. `createServerSupabase`
  // returns an `@supabase/ssr` client whose `cookies.set` hook writes the
  // session cookies onto the *outgoing* response via Next's request-scoped
  // cookies store, so by the time this handler returns the user is signed
  // in for subsequent requests.
  const supabase = createServerSupabase();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: body.password,
  });
  if (signInError) {
    console.error(
      "[api/register/set-password] signInWithPassword failed",
      signInError,
    );
    return errJson(
      "internal_error",
      "Account created but sign-in failed. Please log in manually.",
      500,
    );
  }

  return NextResponse.json({ ok: true, redirect: "/complete-profile" });
}
