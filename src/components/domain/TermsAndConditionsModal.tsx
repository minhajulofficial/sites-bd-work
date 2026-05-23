"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileContract,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import content from "@/content/contentConstants.json";

const terms = content.terms as {
  claimModalTitleTemplate: string;
  claimModalSubtitle: string;
  acceptCheckboxLabel: string;
  scrollHint: string;
  acceptButtonLabel: string;
  declineButtonLabel: string;
  termsAndConditions: string;
  domainUsagePolicy: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A claim target — the minimum the modal needs to render its headline. */
export type TermsAcceptanceTarget = {
  name: string;
  tldId: string;
  fullDomain: string;
};

type TermsAndConditionsModalProps = {
  open: boolean;
  /** The `(name, tldId, fullDomain)` triple the user is claiming. */
  target: TermsAcceptanceTarget | null;
  /** User dismisses the modal (Esc / click-outside / Cancel button). */
  onClose: () => void;
  /**
   * User accepted. Caller is responsible for actually adding the row
   * to the cart + routing. Receives the same target the modal was
   * opened with so the caller doesn't need to thread it through
   * state separately.
   */
  onAccept: (target: TermsAcceptanceTarget) => void | Promise<void>;
};

/**
 * Long-form Terms & Conditions modal shown to **logged-in** users
 * before a claim hits the cart. Per PRD §3.2:
 *
 *   - Headline includes the full domain (e.g. "You are claiming
 *     bdshop.esite.top").
 *   - Body renders the Terms and the Domain Usage Policy from
 *     `contentConstants.json`.
 *   - The "Accept & Add to Cart" button is disabled until BOTH:
 *       (a) the visitor scrolled to the bottom of the policy text, and
 *       (b) the "I Accept" checkbox is ticked.
 *
 * Reuses the modal primitives from PR-12's `WhoisModal` — Tailwind,
 * click-outside-to-close, Esc-to-close, focus trap, body-scroll lock,
 * focus restore on close.
 */
export function TermsAndConditionsModal({
  open,
  target,
  onClose,
  onAccept,
}: TermsAndConditionsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => {
    const tpl = terms.claimModalTitleTemplate;
    return tpl.replace("{{fullDomain}}", target?.fullDomain ?? "");
  }, [target?.fullDomain]);

  // Reset acceptance state every time the modal re-opens or the
  // target changes. Sticky acceptance would let a user breeze through
  // a second claim without re-reading the policy.
  useEffect(() => {
    if (!open) return;
    setScrolledToBottom(false);
    setAccepted(false);
    setSubmitting(false);
  }, [open, target?.tldId, target?.name]);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // 24px slack — visitors don't have to land on the literal final
    // pixel to qualify as "scrolled to the bottom" (a touchpad fling
    // often overshoots).
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (remaining <= 24) setScrolledToBottom(true);
  }, []);

  // Esc + focus trap. Mirrors WhoisModal for visual + behavioral parity.
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
  }, [open, onClose]);

  // Edge case: if the policy text already fits in the viewport
  // (e.g. a much larger window or future shorter content) there is
  // no scrolling to do — treat that as "scrolled to the bottom" so
  // the user isn't stuck.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 1) {
      setScrolledToBottom(true);
    }
  }, [open]);

  const handleAccept = useCallback(async () => {
    if (!target || !scrolledToBottom || !accepted || submitting) return;
    setSubmitting(true);
    try {
      await onAccept(target);
    } finally {
      setSubmitting(false);
    }
  }, [target, scrolledToBottom, accepted, submitting, onAccept]);

  if (!open || !target) return null;

  const canAccept = scrolledToBottom && accepted && !submitting;

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
    >
      <button
        type="button"
        aria-label="Close terms dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        data-focus-guard
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tnc-title"
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl max-h-[90vh]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="tnc-title"
              className="flex items-center text-lg font-semibold text-gray-900"
            >
              <FontAwesomeIcon
                icon={faFileContract}
                className="mr-2 text-primary"
                aria-hidden
              />
              <span className="break-words">{title}</span>
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {terms.claimModalSubtitle}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="tnc-scroll"
          className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-700"
        >
          <PolicySection raw={terms.termsAndConditions} />
          <div className="my-6 border-t border-dashed border-gray-200" />
          <PolicySection raw={terms.domainUsagePolicy} />
          {/* Sentinel — pinned to the bottom so scroll-detection
              has a stable anchor even if Tailwind line-heights
              shift between viewports. */}
          <div aria-hidden className="h-1" />
        </div>

        <div className="border-t border-gray-200 px-5 py-4 space-y-3">
          <label
            className={`flex items-start gap-2 text-sm ${
              scrolledToBottom ? "text-gray-800" : "text-gray-400"
            }`}
          >
            <input
              type="checkbox"
              data-testid="tnc-accept"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={!scrolledToBottom}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
            />
            <span>{terms.acceptCheckboxLabel}</span>
          </label>
          {!scrolledToBottom && (
            <p className="text-xs text-gray-500">{terms.scrollHint}</p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {terms.declineButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={!canAccept}
              data-testid="tnc-accept-button"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && (
                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
              )}
              {terms.acceptButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders one section of the policy text. The source strings use a
 * tiny pseudo-markdown — `##` for section headings, `**foo**` for
 * inline emphasis, blank lines for paragraph breaks. We render that
 * by hand here rather than pulling in a full markdown library; the
 * surface is small and intentional.
 */
function PolicySection({ raw }: { raw: string }) {
  const nodes = useMemo(() => parsePolicy(raw), [raw]);
  return <div className="space-y-3">{nodes}</div>;
}

function parsePolicy(raw: string): ReactNode[] {
  const blocks = raw.split(/\n\n+/);
  return blocks.map((block, idx) => {
    if (block.startsWith("## ")) {
      return (
        <h3
          key={idx}
          className="text-base font-semibold text-gray-900 first:mt-0"
        >
          {block.slice(3).trim()}
        </h3>
      );
    }
    return (
      <p key={idx} className="text-gray-700">
        {renderInline(block)}
      </p>
    );
  });
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
