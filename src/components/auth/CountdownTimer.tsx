"use client";

import { useEffect, useState } from "react";

/**
 * Minute-and-second countdown driven by a target unix-ms timestamp.
 *
 * Renders as `mm:ss`. Calls `onExpire` exactly once when the deadline
 * passes. Re-mounting with a new `targetMs` resets the countdown.
 */
export function CountdownTimer({
  targetMs,
  onExpire,
  className,
}: {
  targetMs: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetMs - Date.now()),
  );

  useEffect(() => {
    setRemaining(Math.max(0, targetMs - Date.now()));
    const id = setInterval(() => {
      const next = Math.max(0, targetMs - Date.now());
      setRemaining(next);
      if (next === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  return (
    <span className={className} aria-live="polite">
      {formatted}
    </span>
  );
}
