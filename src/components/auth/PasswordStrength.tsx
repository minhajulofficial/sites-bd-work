"use client";

import { clsx } from "clsx";
import { useMemo } from "react";

/**
 * Five-point password strength meter.
 *
 * Points (0..5):
 *   1. length >= 8
 *   2. length >= 12 (bonus for long passwords)
 *   3. contains at least one letter
 *   4. contains at least one digit
 *   5. contains at least one symbol or upper+lower case mix
 *
 * The label rendered beneath the bar is consciously not the score
 * itself ("3/5" reads as homework grading) but a categorical word so
 * users can pattern-match at a glance.
 */
export function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = useMemo(() => evaluate(password), [password]);

  return (
    <div className="mt-2">
      <div className="flex h-1.5 w-full gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              "h-full flex-1 rounded-full transition-colors",
              i < score ? color : "bg-gray-200",
            )}
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span
          className={clsx(
            "font-medium",
            score === 0
              ? "text-gray-400"
              : score <= 2
                ? "text-red-600"
                : score === 3
                  ? "text-amber-600"
                  : "text-emerald-600",
          )}
        >
          {label}
        </span>
        <span className="text-gray-400">
          {password.length === 0
            ? "Min 8 chars · letters + numbers"
            : `${password.length} chars`}
        </span>
      </div>
    </div>
  );
}

function evaluate(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: "Enter a password", color: "bg-gray-200" };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Za-z]/u.test(password)) score += 1;
  if (/\d/u.test(password)) score += 1;
  if (/[^A-Za-z0-9]/u.test(password) || (/[a-z]/u.test(password) && /[A-Z]/u.test(password))) {
    score += 1;
  }

  if (score <= 1) return { score, label: "Too weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 3) return { score, label: "Okay", color: "bg-amber-500" };
  if (score === 4) return { score, label: "Strong", color: "bg-emerald-500" };
  return { score, label: "Excellent", color: "bg-emerald-500" };
}
