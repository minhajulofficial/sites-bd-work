"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * Sidebar nav for the admin chrome. Client component so it can read
 * the current pathname and visually highlight the active entry —
 * everything else in the admin layout stays a server component.
 */
export function AdminNav({ items }: { items: ReadonlyArray<AdminNavItem> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm md:flex-col md:overflow-visible">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="md:w-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-50")
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
