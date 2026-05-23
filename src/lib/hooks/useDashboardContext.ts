"use client";

import { createContext, useContext } from "react";

import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Auth + profile snapshot made available to every page rendered
 * inside the (user) route group. Hydrated server-side by
 * `src/app/(user)/layout.tsx` (which calls `requireProfileVerified()`
 * and passes the result through to `<DashboardContextProvider>`),
 * so children can read the current user without their own RSC
 * round-trip.
 *
 * Intentionally narrow: we only expose the fields children of the
 * shell actually need (name + email + customer id + admin flag).
 * Anything richer should be fetched per-page so it stays fresh.
 */
export interface DashboardContextValue {
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    customer_id: string;
    is_admin: boolean;
    status: ProfileRow["status"];
  };
}

export const DashboardContext = createContext<DashboardContextValue | null>(
  null,
);

/**
 * Reads the dashboard context. Throws if the component is rendered
 * outside the (user) layout — that's a programming error and should
 * surface loudly in development.
 */
export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useDashboardContext must be used inside the (user) route group's <DashboardContextProvider>",
    );
  }
  return ctx;
}
