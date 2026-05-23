import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { sendOtpForForgotPassword } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rateLimit";
import { forgotPasswordSendOtpBodySchema } from "@/lib/auth/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_OK_MESSAGE =
  "If your email is registered, we sent a code.";

/**
 * POST /api/auth/forgot-password/send-otp
 *
 * Sends a 6-digit OTP to `email` if (and only if) a profile with that
 * email exists. To prevent membership enumeration this route always
 * returns 200 with the same generic message regardless of whether the
 * email is registered — the existence check is performed inside
 * `sendOtpForForgotPassword` (PR-04) which silently no-ops when no
 * matching profile is found.
 *
 * Rate limit: 3 requests per email per 10 minutes (matches the
 * registration `send-otp` limit). Backed by the in-memory limiter in
 * `src/lib/auth/rateLimit.ts`.
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
    body = forgotPasswordSendOtpBodySchema.parse(raw);
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

  const limit = rateLimit(`forgot-password:send-otp:${body.email}`, {
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

  try {
    await sendOtpForForgotPassword(body.email);
  } catch (e) {
    // Log internally but still return the generic 200 message — we
    // don't want to leak (via differing error shapes) whether the
    // email exists or some unrelated infra hiccup occurred.
    console.error(
      "[api/forgot-password/send-otp] failed to issue OTP",
      e,
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE });
}
