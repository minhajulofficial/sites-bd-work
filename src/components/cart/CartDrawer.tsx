"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCartShopping,
  faSearch,
  faSpinner,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

import { useCart } from "@/lib/hooks/useCart";
import type { CartItem } from "@/lib/cart/types";

import { useCartDrawer } from "./CartDrawerProvider";

/**
 * Right-anchored slide-in cart drawer.
 *
 * Reuses the same accessibility primitives as the PR-12 `WhoisModal`:
 *
 *   - Backdrop click closes.
 *   - `Escape` closes.
 *   - Focus is trapped inside the panel via `Tab` / `Shift+Tab`.
 *   - Focus is restored to the trigger on close.
 *   - The body is `overflow-hidden` while the drawer is open so the
 *     page underneath doesn't scroll.
 *
 * Contents:
 *   - Empty state when the cart is empty.
 *   - Item list otherwise — full domain, hosting plan summary if any,
 *     addons (count only, full list deferred to PR-15), per-row
 *     "Remove".
 *   - Footer with subtotal + "Continue to Checkout" → `/cart` + a
 *     "Continue Shopping" close button.
 */
export function CartDrawer() {
  const { open, closeCartDrawer } = useCartDrawer();
  const { items, total, loading, removeItem } = useCart();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Capture the trigger so we can restore focus when the drawer closes.
  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // Defer to the next paint so the slide-in animation runs first
      // and the close button is actually focusable.
      const id = window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    }
    previousFocusRef.current?.focus?.();
    return undefined;
  }, [open]);

  // Scroll lock while the drawer is up.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Esc-to-close handler is on the panel itself; backdrop has its own.
  const onPanelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeCartDrawer();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [closeCartDrawer],
  );

  const onBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) closeCartDrawer();
    },
    [closeCartDrawer],
  );

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 bg-black/40"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        onKeyDown={onPanelKeyDown}
        className={clsx(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none",
          "translate-x-0 transition-transform",
        )}
      >
        <DrawerHeader
          count={items.length}
          onClose={closeCartDrawer}
          closeButtonRef={closeButtonRef}
        />

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && items.length === 0 ? (
            <DrawerLoading />
          ) : items.length === 0 ? (
            <DrawerEmpty onContinueShopping={closeCartDrawer} />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <CartRow
                  key={item.id}
                  item={item}
                  onRemove={() => void removeItem(item.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <DrawerFooter
          itemCount={items.length}
          total={total}
          onContinueShopping={closeCartDrawer}
        />
      </div>
    </div>
  );
}

function DrawerHeader({
  count,
  onClose,
  closeButtonRef,
}: {
  count: number;
  onClose: () => void;
  closeButtonRef: React.RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
      <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <FontAwesomeIcon icon={faCartShopping} className="text-primary" />
        <span>Your cart</span>
        {count > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {count}
          </span>
        ) : null}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </div>
  );
}

function DrawerLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl" />
      <span className="text-sm">Loading your cart…</span>
    </div>
  );
}

function DrawerEmpty({
  onContinueShopping,
}: {
  onContinueShopping: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <FontAwesomeIcon
        icon={faCartShopping}
        className="text-4xl text-gray-300"
      />
      <p className="text-base font-medium text-gray-900">
        Your cart is empty.
      </p>
      <p className="text-sm text-gray-600">
        Search for a domain to get started.
      </p>
      <Link
        href="/check"
        onClick={onContinueShopping}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
      >
        <FontAwesomeIcon icon={faSearch} />
        Search domains
      </Link>
    </div>
  );
}

function CartRow({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const hostingLabel = useMemo(() => {
    if (!item.hostingType && !item.hostingPlanId) return null;
    if (item.hostingPlanId) return `Plan: ${item.hostingPlanId}`;
    if (item.hostingType === "free") return "Free hosting";
    if (item.hostingType === "premium") return "Premium hosting";
    if (item.hostingType === "custom_ns") return "Custom name servers";
    if (item.hostingType === "custom_ip") return "Custom IP";
    return null;
  }, [item.hostingType, item.hostingPlanId]);

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {item.fullDomain}
          </p>
          {hostingLabel ? (
            <p className="mt-0.5 text-xs text-gray-600">{hostingLabel}</p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">
              Hosting not configured yet
            </p>
          )}
          {item.addons.length > 0 ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {item.addons.length} add-on
              {item.addons.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Remove ${item.fullDomain} from cart`}
          onClick={() => {
            setRemoving(true);
            // Fire-and-forget — the provider will pop the row out of
            // `items` on success; we just need the button to register
            // a click. If it fails the row stays and we re-enable.
            try {
              onRemove();
            } finally {
              window.setTimeout(() => setRemoving(false), 400);
            }
          }}
          disabled={removing}
          className={clsx(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition",
            "hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200",
            removing && "opacity-50",
          )}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </li>
  );
}

function DrawerFooter({
  itemCount,
  total,
  onContinueShopping,
}: {
  itemCount: number;
  total: number;
  onContinueShopping: () => void;
}) {
  return (
    <div className="border-t border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Subtotal</span>
        <span className="font-semibold text-gray-900">
          {total > 0 ? `৳ ${total.toFixed(2)}` : "—"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Hosting plans &amp; add-ons are priced at checkout.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/cart"
          onClick={onContinueShopping}
          aria-disabled={itemCount === 0}
          className={clsx(
            "inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white",
            "hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40",
            itemCount === 0 && "pointer-events-none opacity-50",
          )}
        >
          Continue to Checkout
        </Link>
        <button
          type="button"
          onClick={onContinueShopping}
          className="inline-flex w-full items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
