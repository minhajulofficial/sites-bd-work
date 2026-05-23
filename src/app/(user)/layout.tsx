import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardContextProvider } from "@/components/dashboard/DashboardContextProvider";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import type { DashboardContextValue } from "@/lib/hooks/useDashboardContext";

/**
 * Shared layout for every authenticated `(user)` route group page
 * (`/dash*`, `/domains*`, `/services*`, `/cart*`, `/invoices*`,
 * `/tickets*`).
 *
 * Responsibilities:
 *
 *   1. Defense-in-depth auth check. The middleware already gates the
 *      `(user)` group, but a stale RSC render could theoretically
 *      escape that — calling `requireProfileVerified()` here means
 *      the only way a page renders is for a fully-verified signed-in
 *      user.
 *   2. Hydrate `DashboardContext` with the resolved user + profile
 *      so client components inside the shell (Header, ProfileDropdown,
 *      page bodies) can read them via `useDashboardContext()` without
 *      hitting the database again.
 *   3. Wrap children in `<DashboardLayout>` which paints the Header /
 *      Sidebar / Footer chrome.
 *
 * Forced dynamic — every dashboard page depends on the request's
 * auth cookies and the per-user profile, so static rendering would
 * cache the wrong data.
 */
export const dynamic = "force-dynamic";

export default async function UserGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    if (e instanceof AccountSuspendedError) {
      redirect("/login?error=suspended");
    }
    if (e instanceof ProfileIncompleteError) redirect("/complete-profile");
    throw e;
  }

  const value: DashboardContextValue = {
    user: {
      id: ctx.user.id,
      // `ctx.user.email` is technically optional in Supabase's typings;
      // for an authenticated session it is always present. Fall back
      // to the profile email for safety so the header never shows
      // an empty address.
      email: ctx.user.email ?? ctx.profile.email,
    },
    profile: {
      id: ctx.profile.id,
      email: ctx.profile.email,
      full_name: ctx.profile.full_name,
      customer_id: ctx.profile.customer_id,
      is_admin: ctx.profile.is_admin,
      status: ctx.profile.status,
    },
  };

  return (
    <DashboardContextProvider value={value}>
      <DashboardLayout>{children}</DashboardLayout>
    </DashboardContextProvider>
  );
}
