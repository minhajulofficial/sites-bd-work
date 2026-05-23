"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { resumePendingClaim } from "@/lib/cart/claimResume";

import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileDrawer } from "./MobileDrawer";
import { Sidebar } from "./Sidebar";

/**
 * Top-level chrome wrapper used by every authenticated `(user)`
 * page. Renders a sticky `<Header>`, a fixed 240 px desktop
 * `<Sidebar>`, a slide-in `<MobileDrawer>` for narrow viewports,
 * a scrollable `<main>` content area, and a condensed `<Footer>`.
 *
 * Layout choices:
 *
 *   - The sidebar is `md:flex` (visible at ≥768 px) and lives in the
 *     normal flow so the main content column always shifts to its
 *     right.
 *   - The drawer is rendered unconditionally but stays inert until
 *     `mobileOpen` is true so the slide animation works in both
 *     directions without remounting.
 *   - `min-h-screen flex flex-col` on the wrapper keeps the footer
 *     pinned to the bottom on short pages without sticky positioning.
 *
 * On mount, the layout also drains any pending guest claim left in
 * `sessionStorage` (PR-13). If a valid claim is present we re-verify
 * availability via `/api/domain/check`, add the item to the cart, and
 * push the user to `/cart`. Idempotent across mounts — once consumed
 * the envelope is cleared.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const outcome = await resumePendingClaim();
      if (cancelled) return;
      if (outcome.kind === "added") {
        router.push("/cart");
      }
    })().catch((err) => {
      console.error("[claim-resume] unexpected failure", err);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header onOpenMobileMenu={() => setMobileOpen(true)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          aria-label="Primary navigation"
          className="hidden w-[240px] shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col"
        >
          <Sidebar variant="desktop" />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
