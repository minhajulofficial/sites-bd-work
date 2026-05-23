import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed token that proves a user successfully completed
 * the forgot-password OTP verification step and is now authorised to
 * call the `reset` endpoint. Issued by
 * `POST /api/auth/forgot-password/verify-otp` and consumed by
 * `POST /api/auth/forgot-password/reset`.
 *
 * Format: `v1.<base64url(payload)>.<base64url(hmacSha256(payload))>`
 *
 * Payload JSON: `{ "email": "<email>", "exp": <unix-ms>, "n": "<nonce>" }`.
 *
 * Distinct from `registrationToken.ts` so an attacker can't reuse a
 * token issued by one flow to drive the other. The signing key is
 * domain-separated (`forgot-password|<key>`) so the same underlying
 * secret can be reused without cross-purpose forgery.
 *
 * TTL: 15 minutes per PR-07 spec.
 *
 * Signing key resolution (first one wins):
 *   1. `PASSWORD_RESET_TOKEN_SECRET` (preferred — caller can rotate
 *      independent of the Supabase service-role key).
 *   2. `SUPABASE_SERVICE_ROLE_KEY` (always present where this code runs).
 */

const TTL_MS = 15 * 60 * 1000;
const VERSION = "v1";
const DOMAIN_TAG = "forgot-password";

export interface PasswordResetTokenPayload {
  email: string;
  exp: number;
  /** Random nonce so two tokens issued for the same email differ. */
  n: string;
}

export type PasswordResetTokenError =
  | "invalid_format"
  | "invalid_signature"
  | "expired";

export type PasswordResetTokenResult =
  | { ok: true; payload: PasswordResetTokenPayload }
  | { ok: false; reason: PasswordResetTokenError };

function getSigningKey(): string {
  const base =
    process.env.PASSWORD_RESET_TOKEN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) {
    throw new Error(
      "[auth/passwordResetToken] PASSWORD_RESET_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return `${DOMAIN_TAG}|${base}`;
}

function base64urlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(padded, "base64");
}

function sign(payload: string): string {
  const hmac = createHmac("sha256", getSigningKey());
  hmac.update(payload);
  return base64urlEncode(hmac.digest());
}

/** Creates a signed token tying `email` to a successful OTP verification. */
export function issuePasswordResetToken(email: string): string {
  const payload: PasswordResetTokenPayload = {
    email,
    exp: Date.now() + TTL_MS,
    n: base64urlEncode(
      Buffer.from(crypto.getRandomValues(new Uint8Array(12))),
    ),
  };
  const payloadStr = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = sign(payloadStr);
  return `${VERSION}.${payloadStr}.${signature}`;
}

/**
 * Verifies a token signature + expiry and returns the decoded payload.
 * Never throws — failure modes are returned as `{ ok: false }` so the
 * caller can map them to a 400 response.
 */
export function verifyPasswordResetToken(
  token: string,
): PasswordResetTokenResult {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "invalid_format" };
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return { ok: false, reason: "invalid_format" };
  }
  const [, payloadStr, signature] = parts;

  const expected = sign(payloadStr);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64urlDecode(payloadStr).toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_format" };
  }
  if (!isPayload(parsed)) {
    return { ok: false, reason: "invalid_format" };
  }
  if (parsed.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload: parsed };
}

function isPayload(v: unknown): v is PasswordResetTokenPayload {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.email === "string" &&
    typeof r.exp === "number" &&
    typeof r.n === "string"
  );
}
