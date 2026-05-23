import "server-only";

/**
 * Very small in-memory sliding-window rate limiter.
 *
 * Used by the registration `send-otp` / `verify-otp` routes to prevent
 * trivial brute force. Keys are arbitrary strings (typically a
 * `bucket:identifier` pair, e.g. `register:send-otp:foo@example.com`).
 *
 * Caveats:
 *   - The map is process-local. On Vercel each lambda instance has its
 *     own copy. Good enough for casual abuse, **not** a hard guarantee.
 *     If we ever need stricter limits, swap this out for a
 *     `rate_limits` table or Upstash Redis without touching the call
 *     sites.
 *   - Entries are cleaned up lazily on access. A small `Math.random()`
 *     gate occasionally sweeps the map so it can't grow unbounded if a
 *     long-running worker sees a huge keyspace.
 */

interface Bucket {
  /** Unix-ms timestamps of recent allowed attempts, oldest first. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix-ms of the earliest hit still in the window (only when blocked). */
  retryAt?: number;
}

export interface RateLimitOptions {
  /** Max hits permitted within `windowMs`. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Records a hit for `key` and returns whether it was allowed.
 *
 * Always records the hit on `allowed: true`. On `allowed: false` the
 * window is not extended (the existing hits stay where they are), so
 * the caller will eventually be unblocked once the oldest hit ages out.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  const cutoff = now - opts.windowMs;
  const fresh = bucket.hits.filter((t) => t > cutoff);

  if (fresh.length >= opts.max) {
    bucket.hits = fresh;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAt: fresh[0] + opts.windowMs,
    };
  }

  fresh.push(now);
  bucket.hits = fresh;
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: opts.max - fresh.length,
  };
}

let lastSweep = 0;
function maybeSweep(now: number): void {
  // Sweep at most once per minute, and only when the map is non-trivial.
  if (now - lastSweep < 60_000) return;
  if (buckets.size < 50) {
    lastSweep = now;
    return;
  }
  const cutoff = now - 10 * 60_000;
  for (const [k, b] of buckets) {
    const fresh = b.hits.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      buckets.delete(k);
    } else {
      b.hits = fresh;
    }
  }
  lastSweep = now;
}

/** Test-only: drop every bucket so unit tests can start from a clean slate. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
  lastSweep = 0;
}
