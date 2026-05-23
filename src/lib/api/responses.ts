import { NextResponse } from "next/server";

import { CloudflareError } from "@/lib/cloudflare/types";

/** Standard success envelope: `{ data: ... }`. */
export function okJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

/**
 * Standard error envelope: `{ error: { code, message, errors? } }`.
 * `code` is a machine-stable string identifier; `message` is a short
 * human-readable description; `errors` (optional) is the raw upstream
 * error array, useful for Cloudflare API surface errors.
 */
export function errJson(
  code: string,
  message: string,
  status: number,
  extra?: { errors?: unknown[] },
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(extra?.errors !== undefined ? { errors: extra.errors } : {}),
      },
    },
    { status },
  );
}

/**
 * Translates a thrown error from a `CloudflareClient` call into a JSON
 * response. Maps the upstream HTTP status when present; falls back to
 * `502 Bad Gateway` for unknown / network failures.
 */
export function cloudflareErrorResponse(
  e: unknown,
  tldId: string,
): NextResponse {
  if (e instanceof CloudflareError) {
    const status = e.status >= 400 && e.status < 600 ? e.status : 502;
    return errJson("cloudflare_error", e.message, status, {
      errors: e.errors,
    });
  }
  console.error(`[api dns ${tldId}] unhandled error`, e);
  return errJson("internal_error", "Internal server error", 500);
}
