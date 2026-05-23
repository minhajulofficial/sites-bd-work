"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useCart } from "@/lib/hooks/useCart";
import dashboardContent from "@/content/contentConstants.json";

import {
  DASHBOARD_NAV_ITEMS,
  isNavItemActive,
  type DashboardNavItem,
} from "./navItems";

/**
 * Vertical primary navigation rail used by both the desktop layout
 * (always-visible, fixed 240 px) and the mobile drawer (rendered
 * inside `MobileDrawer`). Active link is highlighted in the brand
 * primary color; cart entry shows a badge sourced from `useCart()`.
 *
 * The component itself is purely presentational — it does not manage
 * the drawer's open/closed state. `onNavigate` is invoked after each
 * link click so the mobile drawer can close itself.
 */
export interface SidebarProps {
  /** Adds an explicit `aria-label` to the underlying `<nav>`. */
  ariaLabel?: string;
  /**
   * Called when the user clicks a nav link. The drawer-wrapped
   * sidebar uses this to close itself once the user picks a page.
   */
  onNavigate?: () => void;
  /** Visual variant — `desktop` keeps the rail compact; `mobile`
   * gives a touch-friendly drawer layout. */
  variant?: "desktop" | "mobile";
}

export function Sidebar({
  ariaLabel,
  onNavigate,
  variant = "desktop",
}: SidebarProps) {
  const pathname = usePathname() ?? "/dash";
  const { count: cartCount } = useCart();

  return (
    <nav
      aria-label={ariaLabel ?? dashboardContent.dashboard.nav.sectionLabel}
      className={clsx(
        "flex h-full w-full flex-col",
        variant === "desktop" ? "py-6" : "pb-6 pt-2",
      )}
    >
      <ul className="flex flex-1 flex-col gap-1 px-3">
        {DASHBOARD_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarLink
              item={item}
              active={isNavItemActive(item, pathname)}
              cartCount={cartCount}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  cartCount,
  onNavigate,
}: {
  item: DashboardNavItem;
  active: boolean;
  cartCount: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        active
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
          active
            ? "bg-primary text-white"
            : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700",
        )}
      >
        <FontAwesomeIcon icon={item.icon} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge === "cart" && cartCount > 0 ? (
        <span
          aria-label={`${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}
          className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
        >
          {cartCount}
        </span>
      ) : null}
    </Link>
  );
}
