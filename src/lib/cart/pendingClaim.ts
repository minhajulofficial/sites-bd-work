"use client";

/**
 * Session-storage helpers for the guest-claim handoff.
 *
 * When an unauthenticated visitor clicks "Claim" on a search result we
 * persist the intended target into `sessionStorage` under
 * {@link PENDING_CLAIM_KEY} and redirect them to `/login?next=/cart`.
 * After login (or registration completion) lands them inside the
 * `(user)` route group, the dashboard layout calls
 * `resumePendingClaim()` which reads this slot, re-verifies
 * availability, drops the item in the cart, and routes the user on
 * to `/cart`.
 *
 * Stored payloads expire after {@link PENDING_CLAIM_TTL_MS} so a
 * visitor who abandoned the flow doesn't get auto-claimed onto a
 * domain they may have forgotten about weeks later.
 */

export const PENDING_CLAIM_KEY = "sites-bd:pendingClaim";

/** Hard expiry for a saved pending claim: 30 minutes. */
export const PENDING_CLAIM_TTL_MS = 30 * 60 * 1000;

export interface PendingClaim {
  tldId: string;
  name: string;
  fullDomain: string;
  timestamp: number;
}

export type PendingClaimInput = Omit<PendingClaim, "timestamp">;

function isPendingClaim(v: unknown): v is PendingClaim {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.tldId === "string" &&
    typeof r.name === "string" &&
    typeof r.fullDomain === "string" &&
    typeof r.timestamp === "number"
  );
}

/** Persist a pending claim (always overwrites any existing slot). */
export function setPendingClaim(input: PendingClaimInput): void {
  if (typeof window === "undefined") return;
  const payload: PendingClaim = {
    tldId: input.tldId,
    name: input.name,
    fullDomain: input.fullDomain,
    timestamp: Date.now(),
  };
  try {
    window.sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(payload));
  } catch {
    /* Storage unavailable — guest claim resume won't work in this
     * tab, but the redirect still happens so the user can manually
     * re-search after login. */
  }
}

/** Read the saved pending claim, returning `null` if missing or malformed. */
export function getPendingClaim(): PendingClaim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_CLAIM_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingClaim(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Drop the saved pending claim, if any. */
export function clearPendingClaim(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    /* ignore */
  }
}

/** `true` if the claim was saved within {@link PENDING_CLAIM_TTL_MS}. */
export function isFreshPendingClaim(
  claim: PendingClaim,
  now: number = Date.now(),
): boolean {
  return now - claim.timestamp <= PENDING_CLAIM_TTL_MS;
}
