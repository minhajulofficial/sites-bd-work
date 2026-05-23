"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { clsx } from "clsx";

/**
 * Six-digit OTP input. Renders six individual `<input maxLength=1>`
 * boxes that auto-advance, support backspace-to-previous-box, accept
 * arrow-key navigation, and paste a 6-digit code anywhere in the row
 * (so users can paste the code copied from an email).
 *
 * Imperatively focuses the first empty cell on every render so the
 * caret follows the user's typing intuitively.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  hasError = false,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  id?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (autoFocus && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocus]);

  const digits = useMemo(() => {
    const padded = (value ?? "").slice(0, length).padEnd(length, "");
    return padded.split("");
  }, [value, length]);

  const focusAt = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(length - 1, idx));
      const el = refs.current[clamped];
      if (el && hasMounted) {
        el.focus();
        el.select();
      }
    },
    [length, hasMounted],
  );

  const handleChange = (idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/gu, "");
    if (!raw) {
      const next = digits.slice();
      next[idx] = "";
      onChange(next.join("").replace(/\s/gu, ""));
      return;
    }
    if (raw.length === 1) {
      const next = digits.slice();
      next[idx] = raw;
      onChange(next.join("").trimEnd());
      if (idx < length - 1) focusAt(idx + 1);
      return;
    }
    // Multi-character input (e.g. pasting into a single box).
    const merged = (value ?? "").slice(0, idx) + raw;
    const trimmed = merged.replace(/\D/gu, "").slice(0, length);
    onChange(trimmed);
    focusAt(Math.min(length - 1, trimmed.length));
  };

  const handleKeyDown = (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        const next = digits.slice();
        next[idx] = "";
        onChange(next.join("").trimEnd());
      } else if (idx > 0) {
        e.preventDefault();
        const next = digits.slice();
        next[idx - 1] = "";
        onChange(next.join("").trimEnd());
        focusAt(idx - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      focusAt(idx - 1);
      return;
    }
    if (e.key === "ArrowRight" && idx < length - 1) {
      e.preventDefault();
      focusAt(idx + 1);
      return;
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/gu, "");
    if (!text) return;
    e.preventDefault();
    const trimmed = text.slice(0, length);
    onChange(trimmed);
    focusAt(Math.min(length - 1, trimmed.length));
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" id={id}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ""}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={clsx(
            "h-12 w-10 sm:h-14 sm:w-12 rounded-lg border text-center text-xl font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "transition-colors disabled:bg-gray-100 disabled:text-gray-400",
            hasError
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-gray-300 bg-white text-gray-900",
          )}
        />
      ))}
    </div>
  );
}
