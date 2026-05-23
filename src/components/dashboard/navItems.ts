import {
  faFileInvoiceDollar,
  faGlobe,
  faHouse,
  faLifeRing,
  faMagnifyingGlass,
  faServer,
  faShoppingCart,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import dashboardContent from "@/content/contentConstants.json";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: IconDefinition;
  /**
   * When true, the link is considered active for any URL starting
   * with `href` (e.g. `/domains/example.com` activates `/domains`).
   * The bare `/dash` link uses exact-match only so it doesn't
   * highlight on `/dash/profile`.
   */
  matchPrefix: boolean;
  /**
   * If set, the sidebar will render this item with a numeric badge
   * sourced from the named slot. Currently only `"cart"` is wired up,
   * via the stub `useCart()` hook.
   */
  badge?: "cart";
}

const nav = dashboardContent.dashboard.nav;

/**
 * The canonical sidebar nav order. Keeping it in a single array
 * (rather than scattered JSX) makes it trivial to:
 *
 *  - render the same items in the desktop sidebar + the mobile
 *    drawer without duplicating labels/icons,
 *  - compute the active link by URL prefix in one place,
 *  - extend the list later (e.g. add Notifications) without hunting
 *    for hard-coded JSX.
 *
 * Note: DNS management is intentionally per-domain
 * (`/domains/[fullDomain]`) and therefore not a top-level entry.
 */
export const DASHBOARD_NAV_ITEMS: ReadonlyArray<DashboardNavItem> = [
  {
    href: "/dash",
    label: nav.dashboard,
    icon: faHouse,
    matchPrefix: false,
  },
  {
    href: "/domains",
    label: nav.myDomains,
    icon: faGlobe,
    matchPrefix: true,
  },
  {
    href: "/check",
    label: nav.searchDomain,
    icon: faMagnifyingGlass,
    matchPrefix: true,
  },
  {
    href: "/services",
    label: nav.services,
    icon: faServer,
    matchPrefix: true,
  },
  {
    href: "/cart",
    label: nav.cart,
    icon: faShoppingCart,
    matchPrefix: true,
    badge: "cart",
  },
  {
    href: "/invoices",
    label: nav.invoices,
    icon: faFileInvoiceDollar,
    matchPrefix: true,
  },
  {
    href: "/tickets",
    label: nav.tickets,
    icon: faLifeRing,
    matchPrefix: true,
  },
  {
    href: "/dash/profile",
    label: nav.profile,
    icon: faUser,
    matchPrefix: false,
  },
];

/**
 * Returns true when `pathname` should highlight the given nav item.
 *
 * `/dash` matches only the exact path, otherwise `/dash/profile`
 * would always also activate `/dash`. `/dash/profile` follows the
 * same exact-match rule.
 *
 * Items with `matchPrefix = true` activate on any nested segment
 * (e.g. `/domains/example.com` activates `/domains`).
 */
export function isNavItemActive(
  item: DashboardNavItem,
  pathname: string,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
