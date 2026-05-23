"use client";

import { useMemo, type ReactNode } from "react";

import {
  DashboardContext,
  type DashboardContextValue,
} from "@/lib/hooks/useDashboardContext";

/**
 * Thin client-component wrapper around `DashboardContext.Provider`.
 * Lives in a separate file so the server-rendered (user) layout can
 * import it without picking up a `"use client"` boundary itself.
 */
export function DashboardContextProvider({
  value,
  children,
}: {
  value: DashboardContextValue;
  children: ReactNode;
}) {
  // Memo guards against an unnecessary re-render storm in child trees
  // when the layout re-evaluates but the auth snapshot is identical.
  const memo = useMemo(() => value, [value]);
  return (
    <DashboardContext.Provider value={memo}>
      {children}
    </DashboardContext.Provider>
  );
}
