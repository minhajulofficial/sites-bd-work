/**
 * Client-safe domain search types and validation helpers.
 *
 * Anything that needs to reach a "use client" component lives here so
 * we never accidentally pull `server-only` into the browser bundle.
 * The server-side search engine in `./search.ts` re-uses these types,
 * so this file is the single source of truth for the public API shape.
 */

export type SearchUnavailableReason =
  | "reserved"
  | "claimed_by_user"
  | "claimed_in_dns";

export interface WhoisSummary {
  registrantName: string | null;
  registrantEmail: string;
  registrationDate: string;
  expiryDate: string;
}

/** One row per `(name × TLD)` pair, as returned by `/api/domain/check`. */
export interface SearchResult {
  name: string;
  tldId: string;
  tldName: string;
  fullDomain: string;
  available: boolean;
  reason?: SearchUnavailableReason;
  error?: string;
  status?: "unknown";
  whois?: WhoisSummary;
}

/** Allowed shape for a single name (must already be lowercased). */
export const NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

/** Hard ceiling matched by the server. */
export const MAX_NAMES_PER_SEARCH = 50;

/** Splits a string on commas / whitespace / newlines and lower-cases. */
export function parseQueryString(input: string): string[] {
  return input
    .split(/[\s,]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Validates a single name against the same rules the API enforces.
 * Returns a human-readable error string, or `null` if the name is OK.
 */
export function validateName(name: string): string | null {
  if (name.length < 2 || name.length > 30) {
    return `"${name}" must be between 2 and 30 characters`;
  }
  if (!NAME_REGEX.test(name)) {
    return `"${name}" can only contain lowercase letters, digits, and hyphens (not at the start or end)`;
  }
  return null;
}

/**
 * Normalises and validates a list of raw inputs. Duplicates are
 * dropped, empty entries skipped, and the first invalid name produces
 * an error. Returns either the cleaned list or an error message.
 */
export function normaliseNames(
  rawNames: string[],
): { ok: true; names: string[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of rawNames) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const err = validateName(name);
    if (err) return { ok: false, error: err };
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  if (names.length === 0) {
    return { ok: false, error: "Enter at least one subdomain name" };
  }
  if (names.length > MAX_NAMES_PER_SEARCH) {
    return {
      ok: false,
      error: `Up to ${MAX_NAMES_PER_SEARCH} names may be checked per request`,
    };
  }
  return { ok: true, names };
}
