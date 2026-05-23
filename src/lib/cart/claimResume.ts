"use client";

/**
 * Pending-claim plumbing for PR-13's guest-claim flow.
 *
 * When a not-yet-signed-in visitor clicks "Claim" on the search
 * results, we stash the `(tldId, name, fullDomain)` triple in
 * `sessionStorage` under `pendingClaim` and bounce them to
 * `/login?next=/cart`. Once they finish signing in (or completing
 * registration), the `(user)` route group's `DashboardLayout` mounts
 * and calls `resumePendingClaim()` from a `useEffect`, which:
 *
 *   1. Reads + validates the pendingClaim envelope.
 *   2. Drops the envelope if it's malformed or older than
 *      `PENDING_CLAIM_TTL_MS` (currently 30 min).
 *   3. Re-verifies availability against `POST /api/domain/check`
 *      restricted to that single (tldId, name) — networks change,
 *      we don't want to silently cart a now-taken name.
 *   4. On confirmed availability, calls `addCartItem(...)` and
 *      navigates to `/cart`.
 *   5. Always clears `sessionStorage.pendingClaim` once consumed,
 *      regardless of outcome, so it can't fire twice.
 */

import { apiAddCartItem } from "@/lib/cart/cartClient";
import { searchDomains } from "@/lib/domain/client";

/** Pending-claim TTL — older envelopes are dropped without an addItem. */
export const PENDING_CLAIM_TTL_MS = 30 * 60 * 1000;

/** sessionStorage key — exported so other code (e.g. tests) can clear it. */
export const PENDING_CLAIM_KEY = "pendingClaim";

export interface PendingClaim {
  tldId: string;
  name: string;
  fullDomain: string;
  /** ms-epoch when the claim was saved. */
  timestamp: number;
}

export type ResumeOutcome =
  | { kind: "no-claim" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "unavailable"; claim: PendingClaim }
  | { kind: "network-error"; claim: PendingClaim; message: string }
  | { kind: "added"; claim: PendingClaim; alreadyInCart: boolean };

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isPendingClaim(value: unknown): value is PendingClaim {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.tldId === "string" &&
    v.tldId.length > 0 &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.fullDomain === "string" &&
    v.fullDomain.length > 0 &&
    typeof v.timestamp === "number" &&
    Number.isFinite(v.timestamp)
  );
}

/**
 * Persist a pending claim into `sessionStorage`. No-op on the server.
 * Always writes a fresh `timestamp` so the TTL clock starts now.
 */
export function savePendingClaim(input: {
  tldId: string;
  name: string;
  fullDomain: string;
}): void {
  if (!isBrowser()) return;
  const payload: PendingClaim = {
    tldId: input.tldId,
    name: input.name,
    fullDomain: input.fullDomain,
    timestamp: Date.now(),
  };
  try {
    window.sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(payload));
  } catch {
    /* private browsing / quota — silently no-op */
  }
}

export function readPendingClaim(): PendingClaim | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_CLAIM_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingClaim(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingClaim(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * Drain a pending claim from `sessionStorage` and, if it's still
 * fresh + still available, add it to the cart. Always clears the
 * envelope on the way out.
 *
 * Intended to be called from a `useEffect` on the dashboard layout's
 * mount. Idempotent — a second call returns `no-claim` because the
 * first call clears storage.
 */
export async function resumePendingClaim(): Promise<ResumeOutcome> {
  if (!isBrowser()) return { kind: "no-claim" };

  const claim = readPendingClaim();
  if (!claim) return { kind: "no-claim" };

  const age = Date.now() - claim.timestamp;
  if (!Number.isFinite(age) || age < 0) {
    clearPendingClaim();
    return { kind: "invalid" };
  }
  if (age > PENDING_CLAIM_TTL_MS) {
    clearPendingClaim();
    return { kind: "expired" };
  }

  // Re-verify availability against the single (tldId, name) before
  // adding to the cart. Catching the entire response in one place so
  // we always clear storage below, no matter which branch fires.
  let outcome: ResumeOutcome;
  try {
    const res = await searchDomains({
      names: [claim.name],
      tldIds: [claim.tldId],
    });
    if (!res.ok) {
      outcome = {
        kind: "network-error",
        claim,
        message: res.error.message,
      };
    } else {
      const row = res.results.find(
        (r) => r.tldId === claim.tldId && r.name === claim.name,
      );
      if (!row || !row.available || row.status === "unknown") {
        outcome = { kind: "unavailable", claim };
      } else {
        // Re-verified — let the server's `/api/cart/items` decide if
        // this is a fresh add or a duplicate. The dashboard layout
        // refreshes the cart provider after we return so the badge
        // reflects either outcome.
        const addRes = await apiAddCartItem({
          tldId: claim.tldId,
          name: claim.name,
          fullDomain: claim.fullDomain,
        });
        if (!addRes.ok) {
          if (addRes.error.code === "duplicate_item") {
            outcome = { kind: "added", claim, alreadyInCart: true };
          } else {
            outcome = {
              kind: "network-error",
              claim,
              message: addRes.error.message,
            };
          }
        } else {
          outcome = { kind: "added", claim, alreadyInCart: false };
        }
      }
    }
  } catch (err) {
    outcome = {
      kind: "network-error",
      claim,
      message:
        err instanceof Error ? err.message : "Could not verify availability",
    };
  }

  clearPendingClaim();
  return outcome;
}
