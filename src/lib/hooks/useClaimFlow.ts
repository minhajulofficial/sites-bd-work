"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { setPendingClaim } from "@/lib/cart/pendingClaim";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCart, type CartItemInput } from "@/lib/hooks/useCart";

import type { TermsAcceptanceTarget } from "@/components/domain/TermsAndConditionsModal";

/** The shape PR-12's search rows pass to `claim()`. */
export type ClaimRow = {
  name: string;
  tldId: string;
  fullDomain: string;
};

export type UseClaimFlowOptions = {
  /**
   * Where to land logged-in users after they accept the T&C and the
   * item is in the cart. Defaults to "/cart"; some entry points
   * (`/domains/new`) may want a different post-claim destination.
   */
  postClaimRedirect?: string;
  /**
   * Where to redirect guests for sign-in. The `?next=` query string
   * is appended automatically. Defaults to "/login".
   */
  loginPath?: string;
  /**
   * Where to send the user after a successful login resumes the
   * pending claim. This becomes the `?next=` value handed to the
   * login page. Defaults to "/cart".
   */
  guestNext?: string;
};

export type ClaimFlow = {
  /** Trigger the claim flow for the given row. Routes guests to login
   *  or opens the T&C modal for signed-in users. */
  claim: (row: ClaimRow) => void;
  /** Wire these directly onto `<TermsAndConditionsModal {...modal} />`. */
  modal: {
    open: boolean;
    target: TermsAcceptanceTarget | null;
    onClose: () => void;
    onAccept: (target: TermsAcceptanceTarget) => void;
  };
  /** `true` once the initial /api/auth/me probe completes. Consumers
   *  can use this to disable the Claim button until the auth state
   *  is known, avoiding a flash of the wrong branch. */
  authResolved: boolean;
};

/**
 * State-aware claim flow per PRD §3.2.
 *
 *   - **Guest** clicks Claim → we drop a `pendingClaim` record into
 *     `sessionStorage` (with a wall-clock timestamp) and route to
 *     `/login?next=/cart`. After login the dashboard layout's
 *     `useResumePendingClaim` reads that slot, re-verifies
 *     availability, and finishes the claim.
 *   - **Logged-in** user clicks Claim → we open the
 *     `TermsAndConditionsModal`. Accepting calls `cart.addItem(...)`
 *     and routes to `/cart`. Closing the modal without accepting
 *     leaves the cart untouched.
 *
 * The hook also re-dispatches PR-12's `domain-claim` `CustomEvent`
 * on every claim attempt so other listeners (analytics, dev
 * tooling) keep working unchanged.
 */
export function useClaimFlow(opts: UseClaimFlowOptions = {}): ClaimFlow {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const { addItem } = useCart();
  const [target, setTarget] = useState<TermsAcceptanceTarget | null>(null);

  const postClaimRedirect = opts.postClaimRedirect ?? "/cart";
  const loginPath = opts.loginPath ?? "/login";
  const guestNext = opts.guestNext ?? "/cart";

  const claim = useCallback(
    (row: ClaimRow) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("domain-claim", { detail: row }),
        );
      }
      // Auth state still resolving — ignore the click. The button
      // should be disabled during this window anyway (see
      // `authResolved`); this guard catches the racing-click case.
      if (loading) return;

      if (user) {
        setTarget({
          name: row.name,
          tldId: row.tldId,
          fullDomain: row.fullDomain,
        });
        return;
      }

      setPendingClaim({
        tldId: row.tldId,
        name: row.name,
        fullDomain: row.fullDomain,
      });
      const nextEncoded = encodeURIComponent(guestNext);
      router.push(`${loginPath}?next=${nextEncoded}`);
    },
    [loading, user, router, loginPath, guestNext],
  );

  const onClose = useCallback(() => setTarget(null), []);

  const onAccept = useCallback(
    (accepted: TermsAcceptanceTarget) => {
      const item: CartItemInput = {
        tldId: accepted.tldId,
        name: accepted.name,
        fullDomain: accepted.fullDomain,
      };
      addItem(item);
      setTarget(null);
      router.push(postClaimRedirect);
    },
    [addItem, router, postClaimRedirect],
  );

  return {
    claim,
    modal: {
      open: target !== null,
      target,
      onClose,
      onAccept,
    },
    authResolved: !loading,
  };
}
