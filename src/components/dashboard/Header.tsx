"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faBell, faShoppingCart } from "@fortawesome/free-solid-svg-icons";

import { useCart } from "@/lib/hooks/useCart";
import { useCartDrawer } from "@/components/cart/CartDrawerProvider";
import { useDashboardContext } from "@/lib/hooks/useDashboardContext";
import dashboardContent from "@/content/contentConstants.json";

import { ProfileDropdown } from "./ProfileDropdown";

/**
 * Top bar shown on every authenticated page. Mobile hamburger sits
 * on the left and is hidden on `md+`. The brand wordmark links back
 * to `/dash`. The right cluster shows:
 *
 *   - notifications bell (placeholder, no logic yet — PR-09+),
 *   - cart icon with a badge counter sourced from `useCart()`
 *     (stub returns `0` for now; PR-14 will wire it up),
 *   - `<ProfileDropdown>` from PR-06.
 */
export interface HeaderProps {
  /** Open the mobile drawer (no-op on desktop). */
  onOpenMobileMenu: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { profile, user } = useDashboardContext();
  const { count: cartCount } = useCart();
  const { openCartDrawer } = useCartDrawer();
  const cartBadgeLabel =
    cartCount > 0
      ? `${dashboardContent.dashboard.header.cart} — ${cartCount} item${
          cartCount === 1 ? "" : "s"
        }`
      : dashboardContent.dashboard.header.cart;

  return (
    <header className="sticky top-0 z-30 w-full bg-primary text-white shadow-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={dashboardContent.dashboard.header.openMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 md:hidden"
        >
          <FontAwesomeIcon icon={faBars} className="text-lg" />
        </button>

        <Link
          href="/dash"
          className="select-none rounded text-lg font-extrabold tracking-wide drop-shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white/40 sm:text-xl"
        >
          {dashboardContent.dashboard.brandName}
        </Link>

        <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
          <IconButton
            label={dashboardContent.dashboard.header.notifications}
            icon={faBell}
          />
          <CartButton
            label={cartBadgeLabel}
            count={cartCount}
            onClick={openCartDrawer}
          />
          <ProfileDropdown
            profile={{
              full_name: profile.full_name,
              email: user.email,
              customer_id: profile.customer_id,
            }}
          />
        </div>
      </div>
    </header>
  );
}

function IconButton({
  label,
  icon,
}: {
  label: string;
  icon: Parameters<typeof FontAwesomeIcon>[0]["icon"];
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-md text-white/90 transition",
        "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40",
      )}
    >
      <FontAwesomeIcon icon={icon} className="text-base" />
    </button>
  );
}

function CartButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      className={clsx(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-md text-white/90 transition",
        "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40",
      )}
    >
      <FontAwesomeIcon icon={faShoppingCart} className="text-base" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 py-0.5 text-[10px] font-bold leading-none text-primary ring-2 ring-primary"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
