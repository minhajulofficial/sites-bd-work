import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { verifyOtpAndConsume } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rateLimit";
import { issueRegistrationToken } from "@/lib/auth/registrationToken";
import { verifyOtpBodySchema } from "@/lib/auth/validation";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register/verify-otp
 *
 * Verifies the 6-digit OTP previously emailed to `email`. On success
 * the route issues a short-lived (30 min) HMAC-signed registration
 * token that the client must pass to
 * `POST /api/auth/register/set-password`, so a malicious caller cannot
 * skip the OTP step.
 *
 * Rate limit: 10 attempts per email per 10 minutes (a bit higher than
 * `send-otp` because honest users routinely fat-finger a digit).
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
    body = verifyOtpBodySchema.parse(raw);
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

  const limit = rateLimit(`register:verify-otp:${body.email}`, {
    max: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return errJson(
      "rate_limited",
      "Too many attempts. Please try again in a few minutes.",
      429,
    );
  }

  const result = await verifyOtpAndConsume(
    body.email,
    body.code,
    "registration",
  );
  if (!result.valid) {
    const reason = result.reason ?? "wrong";
    const message =
      reason === "expired"
        ? authContent.auth.errors.otpExpired
        : reason === "not_found"
          ? authContent.auth.errors.otpNotFound
          : authContent.auth.errors.otpWrong;
    return errJson(`otp_${reason}`, message, 400);
  }

  const token = issueRegistrationToken(body.email);
  return NextResponse.json({ ok: true, token });
}
