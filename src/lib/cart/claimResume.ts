"use client";

import { searchDomains } from "@/lib/domain/client";

import type { CartItemInput, CartSummary } from "@/lib/hooks/useCart";
import {
  clearPendingClaim,
  getPendingClaim,
  isFreshPendingClaim,
  type PendingClaim,
} from "./pendingClaim";

export type ClaimResumeOutcome =
  | { status: "no_pending_claim" }
  | { status: "expired"; claim: PendingClaim }
  | { status: "verification_failed"; claim: PendingClaim; message: string }
  | { status: "no_longer_available"; claim: PendingClaim }
  | { status: "added"; claim: PendingClaim; item: CartItemInput };

type ResumeOptions = {
  /** Cart hook surface — typically the value returned by `useCart()`. */
  cart: Pick<CartSummary, "addItem">;
  /**
   * Navigation callback fired only after a successful add. The
   * dashboard mount uses `router.push("/cart")` here. Receives the
   * resolved item so the caller can decide where to route.
   */
  onAdded?: (item: CartItemInput) => void;
};

/**
 * Resume an in-flight guest claim after the visitor finishes the
 * login / registration flow.
 *
 * Algorithm (per PRD §3.2):
 *
 *   1. Read `sessionStorage[PENDING_CLAIM_KEY]`. If missing or
 *      malformed, exit with `no_pending_claim`.
 *   2. If the saved timestamp is older than `PENDING_CLAIM_TTL_MS`
 *      (30 min), clear the slot and exit with `expired`.
 *   3. Re-verify availability with a single-TLD
 *      `POST /api/domain/check` (we must not auto-claim a domain that
 *      was taken by someone else while the user was signing in).
 *   4. If still available → `cart.addItem(...)`, clear the slot,
 *      invoke `onAdded`, and exit with `added`.
 *   5. If taken / unknown / API failed → clear the slot and exit
 *      with the matching status so the caller can surface a toast.
 *
 * The slot is cleared in every terminal branch so the next page load
 * is clean — partial / failed resumes never linger.
 */
export async function resumePendingClaim(
  opts: ResumeOptions,
): Promise<ClaimResumeOutcome> {
  const claim = getPendingClaim();
  if (!claim) return { status: "no_pending_claim" };

  if (!isFreshPendingClaim(claim)) {
    clearPendingClaim();
    return { status: "expired", claim };
  }

  const res = await searchDomains({
    names: [claim.name],
    tldIds: [claim.tldId],
  });

  if (!res.ok) {
    clearPendingClaim();
    return {
      status: "verification_failed",
      claim,
      message: res.error.message,
    };
  }

  const row = res.results.find(
    (r) => r.tldId === claim.tldId && r.name === claim.name,
  );

  if (!row || !row.available) {
    clearPendingClaim();
    return { status: "no_longer_available", claim };
  }

  const item: CartItemInput = {
    tldId: claim.tldId,
    name: claim.name,
    fullDomain: claim.fullDomain,
  };
  opts.cart.addItem(item);
  clearPendingClaim();
  opts.onAdded?.(item);
  return { status: "added", claim, item };
}
