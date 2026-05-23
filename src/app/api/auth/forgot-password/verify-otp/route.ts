import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import { verifyOtpAndConsume } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rateLimit";
import { issuePasswordResetToken } from "@/lib/auth/passwordResetToken";
import { forgotPasswordVerifyOtpBodySchema } from "@/lib/auth/validation";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password/verify-otp
 *
 * Verifies the 6-digit OTP previously emailed to `email` for the
 * forgot-password flow. On success the route issues a short-lived
 * (15 min) HMAC-signed reset token that the client must pass to
 * `POST /api/auth/forgot-password/reset`, so a malicious caller cannot
 * skip the OTP step.
 *
 * Rate limit: 10 attempts per email per 10 minutes — same as the
 * registration verify-otp route (honest users routinely fat-finger a
 * digit).
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
    body = forgotPasswordVerifyOtpBodySchema.parse(raw);
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

  const limit = rateLimit(`forgot-password:verify-otp:${body.email}`, {
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
    "forgot_password",
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

  const token = issuePasswordResetToken(body.email);
  return NextResponse.json({ ok: true, token });
}
