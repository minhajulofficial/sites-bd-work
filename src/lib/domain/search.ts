import "server-only";

import reservedConfig from "@/config/reservedSubdomains.json";
import { CloudflareError } from "@/lib/cloudflare/types";
import { getCloudflareClient } from "@/lib/cloudflare/client";
import { getEnabledTlds, type TldEntry } from "@/lib/domains/registry";
import { createServiceSupabase } from "@/lib/supabase/server";
import {
  NAME_REGEX,
  parseQueryString as sharedParseQueryString,
  type SearchResult,
  type SearchUnavailableReason,
  type WhoisSummary,
} from "./shared";

// Re-export the public types so existing consumers (`search.ts` was the
// historical home) keep working unchanged.
export type { SearchResult, SearchUnavailableReason, WhoisSummary };
export { NAME_REGEX };

const reservedSet = new Set<string>(
  (reservedConfig as { reserved: string[] }).reserved.map((s) =>
    s.toLowerCase(),
  ),
);

/** Per-TLD timeout for Cloudflare lookups (matches the brief). */
const TLD_TIMEOUT_MS = 3_000;

/** In-memory cache TTL for `(tldId, name)` lookups. */
const CACHE_TTL_MS = 30_000;

/** Hard cap on the size of the LRU cache. */
const CACHE_MAX_ENTRIES = 1_000;

/**
 * Tiny LRU keyed by `${tldId}:${name}`. We deliberately cache the
 * "claimed-or-not" verdict, not the whois envelope, so a freshly-
 * deleted domain becomes available within `CACHE_TTL_MS` even if
 * Cloudflare's listing is a few seconds behind.
 */
interface CacheEntry {
  expiresAt: number;
  /** What was found in the DB row, if any. `null` means "not claimed". */
  claimedBy: { userId: string } | null;
  /** True if the TLD's CF zone has any record on the name. */
  inCloudflare: boolean;
}

const lruCache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry | null {
  const entry = lruCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    lruCache.delete(key);
    return null;
  }
  // Refresh LRU position.
  lruCache.delete(key);
  lruCache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  lruCache.set(key, entry);
  if (lruCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = lruCache.keys().next().value;
    if (oldestKey !== undefined) lruCache.delete(oldestKey);
  }
}

/**
 * Wraps a promise with a timeout. If `ms` elapses before the inner
 * promise settles the returned promise rejects with `TimeoutError`.
 */
class TimeoutError extends Error {
  constructor() {
    super("Lookup timed out");
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError()), ms);
    p.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

/** Masks an email so we never leak the local-part. `r***@gmail.com`. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local[0] ?? "";
  return `${head}***${domain}`;
}

export class InvalidSearchInputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "InvalidSearchInputError";
  }
}

/**
 * Splits a string on commas / whitespace / newlines and lower-cases
 * each token. Empty entries are dropped. Re-exported from `./shared`
 * so server callers don't have to import it from a different module.
 */
export const parseQueryString = sharedParseQueryString;

/** Validation: 2–30 chars, `[a-z0-9-]`, no leading/trailing hyphen. */
function validateName(name: string): void {
  if (name.length < 2 || name.length > 30) {
    throw new InvalidSearchInputError(
      "invalid_name",
      `"${name}" must be between 2 and 30 characters`,
    );
  }
  if (!NAME_REGEX.test(name)) {
    throw new InvalidSearchInputError(
      "invalid_name",
      `"${name}" can only contain lowercase letters, digits, and hyphens (not at the start or end)`,
    );
  }
}

/** True for any token configured in `reservedSubdomains.json`. */
export function isReservedName(name: string): boolean {
  return reservedSet.has(name.toLowerCase());
}

/**
 * Resolves the working set of TLDs for this request.
 *
 *   - Source-of-truth for "what TLDs exist" is `src/config/domains.json`
 *     (the registry's compile-time list, which also carries the
 *     env-var prefix needed to talk to Cloudflare).
 *   - Source-of-truth for "is this TLD currently turned on" is the
 *     `tlds` DB table (admins can flip the bit at runtime).
 *
 * We intersect the two so the search responds instantly when an admin
 * disables a TLD without requiring any code change.
 */
async function resolveTlds(filterIds: string[] | null): Promise<TldEntry[]> {
  const registry = getEnabledTlds();
  const filtered =
    filterIds && filterIds.length > 0
      ? registry.filter((t) => filterIds.includes(t.id))
      : registry;

  if (filtered.length === 0) return [];

  // Cross-check against the `tlds` table. If the DB query fails we
  // fall back to the registry's flag rather than 500-ing the search.
  try {
    const supabase = createServiceSupabase();
    const slugs = filtered.map((t) => t.id);
    const { data, error } = await supabase
      .from("tlds")
      .select("slug, enabled")
      .in("slug", slugs);
    if (error) {
      console.error("[domain/search] tlds DB lookup failed", error);
      return filtered;
    }
    const enabledSlugs = new Set(
      (data ?? [])
        .filter((row: { enabled: boolean }) => row.enabled)
        .map((row: { slug: string }) => row.slug),
    );
    // If the DB has no row for a registry TLD, trust the registry.
    return filtered.filter(
      (t) =>
        enabledSlugs.has(t.id) ||
        !(data ?? []).some(
          (row: { slug: string; enabled: boolean }) => row.slug === t.id,
        ),
    );
  } catch (e) {
    console.error("[domain/search] tlds DB lookup threw", e);
    return filtered;
  }
}

/**
 * Resolves a single `(name × TLD)` pair against the cache, the
 * `domains` table, and the TLD's Cloudflare zone. Returns the raw
 * facts; the calling site assembles the public response (so it can
 * attach the whois envelope on a single round trip).
 */
async function lookupOne(
  name: string,
  tld: TldEntry,
): Promise<{ ok: true; entry: CacheEntry } | { ok: false; reason: string }> {
  const key = `${tld.id}:${name}`;
  const cached = cacheGet(key);
  if (cached) return { ok: true, entry: cached };

  const supabase = createServiceSupabase();
  const fullDomain = `${name}.${tld.name}`;

  // Run the DB row + Cloudflare listing concurrently. Both are
  // bounded by `withTimeout` so a slow Cloudflare zone can't stall
  // the whole search.
  // PostgREST builder is "thenable" but not a real Promise; wrap it
  // so `withTimeout` can race it via `then(resolve, reject)`.
  const dbPromise: Promise<{
    data: { user_id: string } | null;
    error: unknown;
  }> = Promise.resolve(
    supabase
      .from("domains")
      .select("user_id")
      .eq("tld_id", tld.id)
      .eq("name", name)
      .maybeSingle(),
  );

  let cfPromise: Promise<{ count: number }>;
  try {
    const client = getCloudflareClient(tld.id);
    cfPromise = client
      .listSubdomainRecords(fullDomain)
      .then((records) => ({ count: records.length }));
  } catch (e) {
    // Env-var misconfig — surface as "unknown" rather than crashing.
    console.error(
      `[domain/search] getCloudflareClient(${tld.id}) failed`,
      e,
    );
    return {
      ok: false,
      reason: "Could not reach Cloudflare for this TLD.",
    };
  }

  let dbResult: { data: { user_id: string } | null; error: unknown } | null =
    null;
  let cfResult: { count: number } | null = null;

  try {
    [dbResult, cfResult] = await Promise.all([
      withTimeout(dbPromise, TLD_TIMEOUT_MS),
      withTimeout(cfPromise, TLD_TIMEOUT_MS),
    ]);
  } catch (e) {
    if (e instanceof TimeoutError) {
      return {
        ok: false,
        reason: "Lookup timed out for this TLD.",
      };
    }
    if (e instanceof CloudflareError) {
      return {
        ok: false,
        reason: "Cloudflare lookup failed for this TLD.",
      };
    }
    console.error(
      `[domain/search] lookupOne(${name}, ${tld.id}) unexpected failure`,
      e,
    );
    return { ok: false, reason: "Lookup failed for this TLD." };
  }

  if (dbResult?.error) {
    console.error(
      `[domain/search] domains DB lookup failed for ${name}.${tld.name}`,
      dbResult.error,
    );
  }

  const entry: CacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    claimedBy: dbResult?.data ? { userId: dbResult.data.user_id } : null,
    inCloudflare: (cfResult?.count ?? 0) > 0,
  };
  cacheSet(key, entry);
  return { ok: true, entry };
}

/**
 * Fetches a tiny whois envelope for an already-claimed domain. Only
 * called when the search needs to attach `whois` to the response. The
 * payload is intentionally minimal — email is masked, mobile/address
 * are never read.
 */
async function fetchWhois(
  name: string,
  tld: TldEntry,
  userId: string,
): Promise<WhoisSummary | null> {
  try {
    const supabase = createServiceSupabase();
    const [profileRes, domainRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("domains")
        .select("registered_at, expires_at")
        .eq("tld_id", tld.id)
        .eq("name", name)
        .maybeSingle(),
    ]);
    if (!profileRes.data || !domainRes.data) return null;
    const email =
      typeof profileRes.data.email === "string" ? profileRes.data.email : null;
    return {
      registrantName:
        typeof profileRes.data.full_name === "string"
          ? profileRes.data.full_name
          : null,
      registrantEmail: email ? maskEmail(email) : "***",
      registrationDate: String(domainRes.data.registered_at).slice(0, 10),
      expiryDate: String(domainRes.data.expires_at).slice(0, 10),
    };
  } catch (e) {
    console.error(
      `[domain/search] fetchWhois(${name}, ${tld.id}, ${userId}) failed`,
      e,
    );
    return null;
  }
}

/**
 * Public entry point.
 *
 * Validates the inputs, fans out one lookup per `(name × tld)` pair
 * with per-TLD timeouts, and returns one row per pair in registry
 * order. Reserved names short-circuit the lookups and are marked
 * `reason: "reserved"` against every requested TLD.
 *
 * Errors:
 *   - throws `InvalidSearchInputError` for empty input / too many
 *     names / invalid name format. The caller maps that to HTTP 400.
 *   - never throws on a Cloudflare / DB failure — the affected rows
 *     are returned with `status: "unknown"` instead.
 */
export async function checkAvailability(
  names: string[],
  tldIds: string[] | null = null,
): Promise<SearchResult[]> {
  if (!Array.isArray(names) || names.length === 0) {
    throw new InvalidSearchInputError(
      "empty_query",
      "At least one name is required",
    );
  }
  if (names.length > 50) {
    throw new InvalidSearchInputError(
      "too_many_names",
      "Up to 50 names may be checked per request",
    );
  }

  const normalised: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    if (typeof raw !== "string") {
      throw new InvalidSearchInputError(
        "invalid_name",
        "Names must be strings",
      );
    }
    const name = raw.trim().toLowerCase();
    if (name.length === 0) continue;
    validateName(name);
    if (seen.has(name)) continue;
    seen.add(name);
    normalised.push(name);
  }

  if (normalised.length === 0) {
    throw new InvalidSearchInputError(
      "empty_query",
      "At least one name is required",
    );
  }

  const tlds = await resolveTlds(tldIds);
  if (tlds.length === 0) return [];

  // Fan out one async task per (name × tld) pair. The cache + the
  // per-TLD timeout inside `lookupOne` are what keep this cheap.
  const tasks = normalised.flatMap((name) =>
    tlds.map(async (tld): Promise<SearchResult> => {
      const fullDomain = `${name}.${tld.name}`;
      if (isReservedName(name)) {
        return {
          name,
          tldId: tld.id,
          tldName: tld.name,
          fullDomain,
          available: false,
          reason: "reserved",
        };
      }

      const result = await lookupOne(name, tld);
      if (!result.ok) {
        return {
          name,
          tldId: tld.id,
          tldName: tld.name,
          fullDomain,
          available: false,
          status: "unknown",
          error: result.reason,
        };
      }

      const { entry } = result;
      if (entry.claimedBy) {
        const whois = await fetchWhois(name, tld, entry.claimedBy.userId);
        return {
          name,
          tldId: tld.id,
          tldName: tld.name,
          fullDomain,
          available: false,
          reason: "claimed_by_user",
          ...(whois ? { whois } : {}),
        };
      }
      if (entry.inCloudflare) {
        return {
          name,
          tldId: tld.id,
          tldName: tld.name,
          fullDomain,
          available: false,
          reason: "claimed_in_dns",
        };
      }
      return {
        name,
        tldId: tld.id,
        tldName: tld.name,
        fullDomain,
        available: true,
      };
    }),
  );

  return Promise.all(tasks);
}

/** Test-only — clear the LRU between unit tests. */
export function _resetSearchCacheForTests(): void {
  lruCache.clear();
}
