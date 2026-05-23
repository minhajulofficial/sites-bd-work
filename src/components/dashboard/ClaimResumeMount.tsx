"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { resumePendingClaim } from "@/lib/cart/claimResume";
import { useCart } from "@/lib/hooks/useCart";

/**
 * Headless component mounted once inside the `(user)` dashboard
 * layout. On mount it checks for a pending guest claim stashed in
 * `sessionStorage` (see `setPendingClaim` in
 * `src/lib/cart/pendingClaim.ts`) and, if found:
 *
 *   1. Validates the 30-minute freshness window.
 *   2. Re-verifies availability against `/api/domain/check`.
 *   3. Adds the row to the cart via `useCart().addItem(...)`.
 *   4. Clears the pending slot.
 *   5. Routes the user to `/cart`.
 *
 * Renders nothing visually — it's an effect-only mount point.
 */
export function ClaimResumeMount() {
  const router = useRouter();
  const cart = useCart();
  // `useCart()` is stable across renders but addItem reads
  // localStorage on each call, so a single mount-time invocation is
  // enough. Guard with a ref so React strict-mode double-invocation
  // in dev doesn't double-resume.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    void resumePendingClaim({
      cart: { addItem: cart.addItem },
      onAdded: () => {
        router.push("/cart");
      },
    });
    // We intentionally do NOT depend on `cart.addItem` / `router`
    // here — re-running the resume on either identity changing
    // would risk double-adding the same item to the cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
