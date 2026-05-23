import { redirect } from "next/navigation";

import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { ConnectionGuide } from "@/components/dashboard/ConnectionGuide";
import { DonateCTA } from "@/components/dashboard/DonateCTA";
import { FaqAccordion } from "@/components/dashboard/FaqAccordion";
import { RecentDomainsTable } from "@/components/dashboard/RecentDomainsTable";
import { RecentServicesTable } from "@/components/dashboard/RecentServicesTable";
import { StatCards } from "@/components/dashboard/StatCards";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * `/dash` — authenticated dashboard home (PR-09).
 *
 * Five stacked sections, top to bottom:
 *
 *   1. Banner slider — admin-controlled, sourced from the `banners`
 *      table via `GET /api/banners`. Falls back to a static welcome
 *      banner when no rows are active.
 *   2. Stat cards — four clickable metrics (domains, services,
 *      invoices, tickets) for the signed-in user. Counts come from
 *      `getDashboardStats()` here, and the same numbers are served
 *      by `GET /api/dash/stats`.
 *   3. Lower grid — two columns at `lg+`, stacked otherwise. Left
 *      column lists the user's most recent domains + services;
 *      right column ships the connection guide + FAQ.
 *   4. Bottom CTA — donate / support button linking to `/donate`.
 *
 * Forced dynamic — the page reads per-user auth cookies and the
 * counts must always reflect the latest DB state.
 */
export const dynamic = "force-dynamic";

export default async function DashPage() {
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

  const supabase = createServerSupabase();
  const stats = await getDashboardStats(supabase, ctx.user.id);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <BannerSlider />

      <StatCards stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <RecentDomainsTable supabase={supabase} userId={ctx.user.id} />
          <RecentServicesTable supabase={supabase} userId={ctx.user.id} />
        </div>
        <div className="flex flex-col gap-6">
          <ConnectionGuide />
          <FaqAccordion />
        </div>
      </div>

      <DonateCTA />
    </div>
  );
}
