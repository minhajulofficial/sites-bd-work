"use client";

import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdCard, faXmark } from "@fortawesome/free-solid-svg-icons";

import type { SearchResult } from "@/lib/domain/shared";

type WhoisModalProps = {
  open: boolean;
  result: SearchResult | null;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tailwind-only modal that renders the minimal whois envelope returned
 * by `/api/domain/check`.
 *
 *   - click-outside closes
 *   - Esc closes
 *   - focus is trapped inside the dialog while open
 *   - focus is restored to the element that opened the modal on close
 *   - reserved / dns-only takens (no whois) render a graceful fallback
 */
export function WhoisModal({ open, result, onClose }: WhoisModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  // Esc + focus trap
  useEffect(() => {
    if (!open) return;

    lastActiveElement.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("data-focus-guard"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);

    // Focus the close button on open so keyboard users land somewhere
    // predictable and the trap has an anchor.
    const t = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    // Lock body scroll while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger.
      lastActiveElement.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !result) return null;

  const whois = result.whois;

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
    >
      {/* Backdrop — click-outside closes */}
      <button
        type="button"
        aria-label="Close whois dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        data-focus-guard
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whois-title"
        className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2
            id="whois-title"
            className="flex items-center text-lg font-semibold text-gray-900"
          >
            <FontAwesomeIcon
              icon={faIdCard}
              className="mr-2 text-primary"
              aria-hidden
            />
            Whois
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Domain
            </div>
            <div className="font-mono text-base font-semibold text-gray-900 break-all">
              {result.fullDomain}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Domain on{" "}
              <span className="font-medium text-gray-700">
                .{result.tldName}
              </span>
            </div>
          </div>

          {whois ? (
            <dl className="divide-y divide-gray-100 rounded-md border border-gray-100">
              <Row
                label="Registrant's Name"
                value={whois.registrantName ?? "—"}
              />
              <Row label="Registrant's Email" value={whois.registrantEmail} />
              <Row label="Registration Date" value={whois.registrationDate} />
              <Row label="Expiry Date" value={whois.expiryDate} />
            </dl>
          ) : (
            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-4 text-sm text-gray-600">
              {result.reason === "reserved"
                ? "This name is reserved by SITES.BD and cannot be claimed."
                : "No registrant information is available for this domain."}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900 break-all">
        {value}
      </dd>
    </div>
  );
}
