import "server-only";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

import { createServiceSupabase } from "@/lib/supabase/server";
import { authTemplates, renderTemplate, sendEmail } from "@/lib/email/send";

/**
 * OTP issuance + verification.
 *
 * - Codes are 6-digit numeric, generated via `crypto.randomInt` (CSPRNG).
 * - Stored as bcrypt hashes; plaintext never touches the database.
 * - 5-minute expiry, single-use (set `consumed_at` on the row on
 *   successful verification).
 * - All writes go through the service-role client because the
 *   `otp_codes` table is intentionally not user-readable (RLS denies
 *   direct user access — see PR-02).
 *
 * Email enumeration mitigations:
 *   - `sendOtpForRegistration` is fired by the registration flow which
 *     has already verified the email is **not** taken.
 *   - `sendOtpForForgotPassword` silently no-ops when no profile with
 *     the given email exists so an attacker can't probe membership.
 */

const OTP_TTL_MS = 5 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

export type OtpPurpose = "registration" | "forgot_password";

export type OtpVerifyReason = "expired" | "wrong" | "not_found";

export interface OtpVerifyResult {
  valid: boolean;
  reason?: OtpVerifyReason;
}

/** 6-digit numeric code, cryptographically secure. Zero-padded. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Issues a fresh registration OTP for `email`:
 *
 * 1. Invalidates any prior unconsumed registration OTPs for this email
 *    (sets `consumed_at = now()` so they can no longer be redeemed).
 * 2. Inserts a new row with `code_hash`, `purpose = 'registration'`,
 *    `expires_at = now() + 5 minutes`.
 * 3. Sends the OTP via email (dev mode logs to console).
 *
 * **Important:** the caller must have already validated that the email
 * is not already registered. This helper does not check.
 */
export async function sendOtpForRegistration(email: string): Promise<void> {
  await issueAndSendOtp(email, "registration");
}

/**
 * Like `sendOtpForRegistration` but for the password-reset flow, and
 * silently no-ops when no profile matches `email` so an attacker can't
 * use this endpoint to enumerate registered emails.
 */
export async function sendOtpForForgotPassword(email: string): Promise<void> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    throw new Error(`[auth/otp] forgot-password profile lookup failed: ${error.message}`);
  }
  if (!data) return;
  await issueAndSendOtp(email, "forgot_password");
}

/**
 * Verifies `code` against the latest non-consumed OTP row for the given
 * email + purpose. On success marks the row consumed and returns
 * `{ valid: true }`. On any failure returns
 * `{ valid: false, reason: 'expired' | 'wrong' | 'not_found' }`.
 *
 * Never throws on a wrong code — failure modes are returned as data so
 * the caller can render a user-friendly message.
 */
export async function verifyOtpAndConsume(
  email: string,
  code: string,
  purpose: OtpPurpose,
): Promise<OtpVerifyResult> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("otp_codes")
    .select("id, code_hash, expires_at, consumed_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[auth/otp] verify lookup failed: ${error.message}`);
  }
  if (!data) return { valid: false, reason: "not_found" };

  const row = data as {
    id: string;
    code_hash: string;
    expires_at: string;
    consumed_at: string | null;
  };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  const ok = await verifyOtp(code, row.code_hash);
  if (!ok) return { valid: false, reason: "wrong" };

  const { error: consumeError } = await supabase
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (consumeError) {
    throw new Error(`[auth/otp] consume update failed: ${consumeError.message}`);
  }
  return { valid: true };
}

async function issueAndSendOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const supabase = createServiceSupabase();

  const { error: invalidateError } = await supabase
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null);
  if (invalidateError) {
    throw new Error(
      `[auth/otp] invalidate prior codes failed: ${invalidateError.message}`,
    );
  }

  const code = generateOtp();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from("otp_codes").insert({
    email,
    code_hash: codeHash,
    purpose,
    expires_at: expiresAt,
  });
  if (insertError) {
    throw new Error(`[auth/otp] insert failed: ${insertError.message}`);
  }

  const tpl =
    purpose === "registration"
      ? {
          subject: authTemplates.otpEmailSubject,
          text: authTemplates.otpEmailBody,
          html: authTemplates.otpEmailHtml,
        }
      : {
          subject: authTemplates.forgotPasswordEmailSubject,
          text: authTemplates.forgotPasswordEmailBody,
          html: authTemplates.forgotPasswordEmailHtml,
        };

  await sendEmail({
    to: email,
    subject: tpl.subject,
    text: renderTemplate(tpl.text, { code }),
    html: renderTemplate(tpl.html, { code }),
  });
}
