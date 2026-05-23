import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { sendOtpForRegistration } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rateLimit";
import { sendOtpBodySchema } from "@/lib/auth/validation";
import { createServiceSupabase } from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register/send-otp
 *
 * Issues a 6-digit registration OTP to `email`. The OTP is hashed in
 * the database (PR-04) and emailed via the configured SMTP transport;
 * in dev the email body is logged to the console.
 *
 * Conflict rules:
 *   - If a `profiles` row with this email already exists **and** the
 *     status is `profile_verified`, return 409 `email_taken`. The user
 *     should sign in or use forgot-password instead.
 *   - Any other state (no profile, or profile in `pending_otp`/
 *     `pre_verified`) is treated as a fresh registration: the OTP
 *     helper itself invalidates prior unconsumed codes.
 *
 * Rate limit: 3 requests per email per 10 minutes. Implementation uses
 * an in-memory map (`src/lib/auth/rateLimit.ts`) — see that file for
 * trade-offs.
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
    body = sendOtpBodySchema.parse(raw);
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

  const limit = rateLimit(`register:send-otp:${body.email}`, {
    max: 3,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return errJson(
      "rate_limited",
      "Too many requests. Please try again in a few minutes.",
      429,
    );
  }

  const supabase = createServiceSupabase();
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("status")
    .eq("email", body.email)
    .maybeSingle();
  if (lookupError) {
    console.error("[api/register/send-otp] profile lookup failed", lookupError);
    return errJson("internal_error", "Internal server error", 500);
  }

  if (existing && (existing as { status: string }).status === "profile_verified") {
    return errJson(
      "email_taken",
      authContent.auth.errors.emailTaken,
      409,
    );
  }

  try {
    await sendOtpForRegistration(body.email);
  } catch (e) {
    console.error("[api/register/send-otp] failed to send OTP", e);
    return errJson("internal_error", "Failed to send verification code", 500);
  }

  return NextResponse.json({ ok: true });
}
