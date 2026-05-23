import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNav, type AdminNavItem } from "./AdminNav";

/**
 * Minimal chrome shared by every `/admin/*` page. PR-10 only ships
 * the "Banners" entry — the rest of the admin panel (TLDs, users,
 * DNS overwrites, etc.) comes online in PR-22+ and will append to
 * this nav.
 */
const NAV_ITEMS: ReadonlyArray<AdminNavItem> = [
  { href: "/admin/banners", label: "Banners" },
];

export function AdminLayout({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="text-lg font-bold text-primary hover:text-primary-deep"
          >
            SITES.BD admin
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="hidden sm:inline">{userEmail}</span>
            <Link
              href="/dash"
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
        <aside className="md:w-56 md:shrink-0">
          <AdminNav items={NAV_ITEMS} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
