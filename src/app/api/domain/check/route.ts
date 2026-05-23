import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import { rateLimit } from "@/lib/auth/rateLimit";
import {
  InvalidSearchInputError,
  checkAvailability,
  parseQueryString,
} from "@/lib/domain/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body schema:
 *
 *   - `query`  — single name or comma/whitespace-separated list. The
 *     UI on the homepage / `/check` page sends this shape.
 *   - `names`  — explicit array. Either of `query` / `names` may be
 *     supplied; if both are present `names` wins.
 *   - `tldIds` — optional whitelist; defaults to every enabled TLD.
 */
const bodySchema = z.object({
  query: z.string().max(2_000).optional(),
  names: z.array(z.string().max(64)).max(50).optional(),
  tldIds: z.array(z.string().max(64)).max(20).optional(),
});

const RATE_LIMIT = { max: 30, windowMs: 60_000 };

export async function POST(request: NextRequest): Promise<NextResponse> {
  // IP-based rate limit. `x-forwarded-for` is the de-facto header on
  // both Vercel and our self-host setup; fall back to the
  // `request.ip` field (Next.js' edge runtime fills it in) and then
  // to a fixed bucket so a bad proxy can't accidentally let abusers
  // through.
  const ip = extractClientIp(request);
  const limit = rateLimit(`domain-check:${ip}`, RATE_LIMIT);
  if (!limit.allowed) {
    return errJson(
      "rate_limited",
      "Too many search requests. Please wait a minute.",
      429,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errJson("invalid_body", "Request body must be JSON", 400);
  }

  let body;
  try {
    body = bodySchema.parse(raw);
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

  // Build the working name list. `names` wins over `query` so callers
  // that already tokenised client-side don't have us re-parse.
  const names = body.names && body.names.length > 0
    ? body.names
    : body.query
      ? parseQueryString(body.query)
      : [];

  try {
    const results = await checkAvailability(
      names,
      body.tldIds && body.tldIds.length > 0 ? body.tldIds : null,
    );
    return okJson({ results });
  } catch (e) {
    if (e instanceof InvalidSearchInputError) {
      return errJson(e.code, e.message, 400);
    }
    console.error("[api/domain/check] unexpected failure", e);
    return errJson("internal_error", "Search failed", 500);
  }
}

/**
 * Extracts the client IP for the rate-limit bucket. Tries the
 * standard reverse-proxy headers first and falls back to a constant
 * (so a single bucket absorbs requests with no IP info, which is
 * safer than letting them all bypass the limiter).
 */
function extractClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    // First entry is the original client.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  // `ip` is set by the Next.js runtime when running on the edge /
  // node server; it's `undefined` during `next build` page data
  // collection.
  const direct = (request as unknown as { ip?: string }).ip;
  if (direct) return direct;
  return "unknown";
}
