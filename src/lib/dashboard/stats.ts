import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Aggregate counts surfaced on the four `/dash` stat cards. The
 * shape is exposed through `GET /api/dash/stats` and consumed
 * directly by the server-rendered StatCards on the dashboard
 * home — both paths go through this helper so the numbers stay
 * in sync.
 */
export interface DashboardStats {
  domains: number;
  services: number;
  invoices: number;
  tickets: number;
}

/**
 * Returns the four headline counts for the signed-in user.
 *
 * Each query uses `head: true` so Postgres only sends back the
 * exact-count metadata, not the rows themselves. The filters mirror
 * PRD §6:
 *
 *   - **domains**: every row the user owns.
 *   - **services**: rows where the renewal status is `active` *or*
 *     the one-time status is `processing` / `complete` — i.e. any
 *     service the user currently has provisioned or is being
 *     fulfilled.
 *   - **invoices**: rows still awaiting payment.
 *   - **tickets**: rows in any non-terminal state (`open`,
 *     `awaiting_user`, `awaiting_admin`).
 *
 * Counts that fail individually are reported as `0` rather than
 * blowing up the entire dashboard render — a missing widget is a
 * better UX than a 500. Errors are logged for debugging.
 */
export async function getDashboardStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardStats> {
  const [domains, services, invoices, tickets] = await Promise.all([
    countRows(
      supabase,
      "domains",
      (q) => q.eq("user_id", userId),
    ),
    countRows(supabase, "services", (q) =>
      q
        .eq("user_id", userId)
        .or(
          "status_renewal.eq.active,status_onetime.in.(processing,complete)",
        ),
    ),
    countRows(supabase, "invoices", (q) =>
      q.eq("user_id", userId).eq("status", "pending_payment"),
    ),
    countRows(supabase, "tickets", (q) =>
      q
        .eq("user_id", userId)
        .in("status", ["open", "awaiting_user", "awaiting_admin"]),
    ),
  ]);

  return { domains, services, invoices, tickets };
}

type CountQueryBuilder = ReturnType<
  ReturnType<SupabaseClient["from"]>["select"]
>;

async function countRows(
  supabase: SupabaseClient,
  table: string,
  apply: (q: CountQueryBuilder) => CountQueryBuilder,
): Promise<number> {
  const base = supabase.from(table).select("*", { count: "exact", head: true });
  const { count, error } = await apply(base);
  if (error) {
    console.error(`[dashboard/stats] count failed for ${table}`, error);
    return 0;
  }
  return count ?? 0;
}
