import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed token that proves a user successfully completed
 * the OTP verification step and is now authorised to call the
 * `set-password` endpoint. Issued by `POST /api/auth/register/verify-otp`
 * and consumed (single-use logically — the password step swaps it for a
 * real Supabase session anyway) by
 * `POST /api/auth/register/set-password`.
 *
 * Format: `v1.<base64url(payload)>.<base64url(hmacSha256(payload))>`
 *
 * Payload JSON: `{ "email": "<email>", "exp": <unix-ms>, "n": "<nonce>" }`.
 *
 * Why a stateless signed token instead of a `pending_registrations`
 * table? Per PRD-§3.1 either is acceptable. A stateless signed token
 * keeps the schema unchanged (PR-02 doesn't include this table), works
 * cleanly across Vercel lambda boundaries, and is trivially
 * unforgeable as long as the signing key stays server-side.
 *
 * Signing key resolution (first one wins):
 *   1. `REGISTRATION_TOKEN_SECRET` (preferred — caller can rotate
 *      independent of the Supabase service-role key).
 *   2. `SUPABASE_SERVICE_ROLE_KEY` (already server-only, always
 *      present where this code runs).
 */

const TTL_MS = 30 * 60 * 1000;
const VERSION = "v1";

export interface RegistrationTokenPayload {
  email: string;
  exp: number;
  /** Random nonce so two tokens issued for the same email differ. */
  n: string;
}

export type RegistrationTokenError =
  | "invalid_format"
  | "invalid_signature"
  | "expired";

export type RegistrationTokenResult =
  | { ok: true; payload: RegistrationTokenPayload }
  | { ok: false; reason: RegistrationTokenError };

function getSigningKey(): string {
  const key =
    process.env.REGISTRATION_TOKEN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "[auth/registrationToken] REGISTRATION_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return key;
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
export function issueRegistrationToken(email: string): string {
  const payload: RegistrationTokenPayload = {
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
export function verifyRegistrationToken(
  token: string,
): RegistrationTokenResult {
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

function isPayload(v: unknown): v is RegistrationTokenPayload {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.email === "string" &&
    typeof r.exp === "number" &&
    typeof r.n === "string"
  );
}
