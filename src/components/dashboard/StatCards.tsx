import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileInvoiceDollar,
  faGlobe,
  faLifeRing,
  faServer,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import type { DashboardStats } from "@/lib/dashboard/stats";

interface StatCardConfig {
  key: keyof DashboardStats;
  label: string;
  href: string;
  cta: string;
  ctaHref: string;
  icon: IconDefinition;
  /** Tailwind class used for the icon tile background. */
  accent: string;
}

/**
 * Static config for the four cards. `href` is what the card body
 * (the big number + label) links to — i.e. the "Domains" card's
 * number takes you to `/domains`. `ctaHref` is the link rendered
 * beneath the number per PRD §6 — typically a primary action like
 * "Add new domain". Splitting the two lets us show the high-traffic
 * shortcut alongside the more discoverable "drill down to the list"
 * affordance.
 */
const CARDS: ReadonlyArray<StatCardConfig> = [
  {
    key: "domains",
    label: "Domains",
    href: "/domains",
    cta: "Add New Domain",
    ctaHref: "/check",
    icon: faGlobe,
    accent: "bg-blue-100 text-blue-600",
  },
  {
    key: "services",
    label: "Services",
    href: "/services",
    cta: "Explore Services",
    ctaHref: "/services",
    icon: faServer,
    accent: "bg-purple-100 text-purple-600",
  },
  {
    key: "invoices",
    label: "Invoices",
    href: "/invoices",
    cta: "View Statements",
    ctaHref: "/invoices",
    icon: faFileInvoiceDollar,
    accent: "bg-amber-100 text-amber-600",
  },
  {
    key: "tickets",
    label: "Tickets",
    href: "/tickets",
    cta: "Create New Ticket",
    ctaHref: "/tickets/new",
    icon: faLifeRing,
    accent: "bg-emerald-100 text-emerald-600",
  },
];

/**
 * Stats row — four clickable metric cards. Counts are computed
 * server-side in the page (via `getDashboardStats`) so the initial
 * paint already shows the real numbers without a client-side
 * fetch. The same numbers are also exposed at `GET /api/dash/stats`
 * for programmatic consumers.
 */
export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <section
      aria-label="Account summary"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {CARDS.map((card) => (
        <StatCard key={card.key} card={card} value={stats[card.key]} />
      ))}
    </section>
  );
}

function StatCard({ card, value }: { card: StatCardConfig; value: number }) {
  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <Link
        href={card.href}
        className="flex items-start justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`${card.label}: ${value}`}
      >
        <div>
          <p className="text-sm font-medium text-gray-500">{card.label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-full ${card.accent}`}
        >
          <FontAwesomeIcon icon={card.icon} className="h-5 w-5" />
        </span>
      </Link>
      <Link
        href={card.ctaHref}
        className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:text-primary-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {card.cta}
        <span aria-hidden="true" className="ml-1">
          →
        </span>
      </Link>
    </article>
  );
}
