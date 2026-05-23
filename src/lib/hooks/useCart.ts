"use client";

/**
 * Stub cart hook. Returns a frozen snapshot with `count = 0` for now;
 * PR-14 will replace the body with a real store (likely React Context
 * + an `/api/cart` fetch on mount).
 *
 * Kept intentionally simple so consumers can already wire the cart
 * icon's badge counter today without changing their call sites later.
 */
export interface CartSummary {
  /** Total number of items currently in the cart. */
  count: number;
}

export function useCart(): CartSummary {
  return { count: 0 };
}
