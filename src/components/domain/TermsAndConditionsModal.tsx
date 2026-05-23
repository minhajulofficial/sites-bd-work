"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import content from "@/content/contentConstants.json";

type TermsAndConditionsModalProps = {
  open: boolean;
  /** Full domain being claimed, e.g. `bdshop.esite.top` — used in the headline. */
  fullDomain: string | null;
  /** Called once the user has scrolled to the bottom, ticked Accept, and pressed the CTA. */
  onAccept: () => void;
  /** Called on Esc / backdrop click / explicit Close. */
  onClose: () => void;
  /**
   * Disables the CTA + close buttons while the parent is busy committing
   * the claim (e.g. mid-`addItem` call followed by router navigation).
   * Optional — defaults to `false`.
   */
  busy?: boolean;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How many CSS pixels we tolerate before considering "scrolled to bottom". */
const SCROLL_BOTTOM_EPSILON = 4;

/**
 * Long-form T&C modal shown to a logged-in user immediately before a
 * domain claim is committed to the cart. Per PRD §3.2 the user must:
 *
 *   1. Scroll the body to the bottom — the "I Accept" checkbox is
 *      disabled until then.
 *   2. Tick the "I Accept" checkbox — the "Accept & Add to Cart" CTA
 *      is disabled until both 1 and 2 are true.
 *   3. Click the CTA — the parent component handles `addItem(...)`
 *      and the redirect to `/cart`.
 *
 * UX details borrowed from `WhoisModal` (the existing PR-12 modal
 * primitive): click-outside / Esc closes, focus trap, scroll lock on
 * body, focus restoration on close.
 */
export function TermsAndConditionsModal({
  open,
  fullDomain,
  onAccept,
  onClose,
  busy = false,
}: TermsAndConditionsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const terms = content.terms;

  // Reset per-open state so reopening the modal always starts from
  // "not yet read, not yet accepted".
  useEffect(() => {
    if (!open) {
      setScrolledToEnd(false);
      setAccepted(false);
    }
  }, [open]);

  // Esc + focus trap + scroll-lock. Same shape as WhoisModal so the
  // a11y behavior is consistent across the app's modals.
  useEffect(() => {
    if (!open) return;

    lastActiveElement.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onClose();
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
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    const t = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = previousOverflow;
      lastActiveElement.current?.focus?.();
    };
  }, [open, onClose, busy]);

  // If the body is shorter than the viewport, "scrolled to bottom" is
  // already satisfied on mount — otherwise the user could never accept.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.clientHeight <= SCROLL_BOTTOM_EPSILON) {
      setScrolledToEnd(true);
    }
  }, [open]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_EPSILON;
    if (atBottom) setScrolledToEnd(true);
  }, []);

  const canAccept = scrolledToEnd && accepted && !busy;

  const headline = useMemo(() => {
    if (!fullDomain) return "You are claiming a SITES.BD subdomain";
    return `You are claiming ${fullDomain}`;
  }, [fullDomain]);

  if (!open) return null;

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
    >
      <button
        type="button"
        aria-label="Close terms and conditions dialog"
        onClick={() => {
          if (!busy) onClose();
        }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        data-focus-guard
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tc-title"
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{ maxHeight: "min(90vh, 720px)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="tc-title"
              className="flex items-center text-lg font-semibold text-gray-900"
            >
              <FontAwesomeIcon
                icon={faFileLines}
                className="mr-2 text-primary"
                aria-hidden
              />
              Terms &amp; Conditions
            </h2>
            <p
              className="mt-1 truncate text-sm text-gray-600"
              data-testid="tc-headline"
            >
              {headline}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-700"
          data-testid="tc-body"
        >
          <section aria-labelledby="tc-tos">
            <h3 id="tc-tos" className="sr-only">
              Terms of Service
            </h3>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
              {terms.termsAndConditions}
            </pre>
          </section>

          <section aria-labelledby="tc-policy" className="mt-6">
            <h3 id="tc-policy" className="sr-only">
              Domain Usage Policy
            </h3>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
              {terms.domainUsagePolicy}
            </pre>
          </section>

          <p
            className="mt-6 text-xs italic text-gray-500"
            data-testid="tc-end-marker"
          >
            End of agreement.
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
          {!scrolledToEnd ? (
            <p className="text-xs text-gray-500" role="status">
              Scroll to the end of the agreement to enable acceptance.
            </p>
          ) : null}
          <label
            className={
              "flex cursor-pointer items-start gap-2 text-sm " +
              (scrolledToEnd ? "text-gray-800" : "text-gray-400")
            }
          >
            <input
              type="checkbox"
              checked={accepted}
              disabled={!scrolledToEnd || busy}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
              data-testid="tc-accept-checkbox"
            />
            <span>
              I have read and agree to the Terms of Service and the Domain
              Usage Policy. I confirm I will operate{" "}
              {fullDomain ? (
                <span className="font-mono font-semibold">{fullDomain}</span>
              ) : (
                "this subdomain"
              )}{" "}
              in line with both.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (canAccept) onAccept();
              }}
              disabled={!canAccept}
              data-testid="tc-accept-cta"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              ) : null}
              {busy ? "Adding…" : "Accept & Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
