"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import dashboardContent from "@/content/contentConstants.json";

import { Sidebar } from "./Sidebar";

/**
 * Mobile-only slide-in drawer that hosts the same `<Sidebar>` used
 * on desktop. Implements:
 *
 *   - tailwind transform `translate-x` transition (left → right),
 *   - clickable backdrop that dismisses on tap,
 *   - Escape-key dismissal,
 *   - focus-trap-lite: focuses the close button on open so screen
 *     readers + keyboard users land somewhere sane (full focus trap
 *     can come later if it proves necessary),
 *   - auto-close on route change so navigating from a nav link
 *     leaves the drawer hidden when the next page renders.
 *
 * Renders an inert (`pointer-events-none`, opacity 0, `-translate-x-full`)
 * subtree when closed so the transition stays animated in both
 * directions without remounting.
 */
export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-close when the route changes. Mobile users tapping a nav
  // link expect the drawer to vanish as they navigate away.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // When the drawer opens, focus the close button so keyboard /
  // screen-reader users have a clear anchor.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  // Lock body scroll while open so the page underneath doesn't move.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      className={clsx(
        "fixed inset-0 z-40 md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={clsx(
          "absolute inset-0 h-full w-full bg-black/40 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={dashboardContent.dashboard.nav.sectionLabel}
        className={clsx(
          "absolute inset-y-0 left-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-base font-bold tracking-wide text-primary">
            {dashboardContent.dashboard.brandName}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={dashboardContent.dashboard.header.closeMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar variant="mobile" onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}
