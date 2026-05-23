import { NextResponse } from "next/server";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { createServerSupabase } from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dash/stats
 *
 * Returns the four headline counts shown on the dashboard home:
 * domains, active services, pending invoices, and open tickets.
 * Scoped to the signed-in user — the underlying queries filter by
 * `user_id = auth.uid()` and RLS would block any other row from
 * being returned even if that filter were missing.
 *
 * Response: `{ data: { domains, services, invoices, tickets } }`.
 */
export async function GET(): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return errJson(
        "unauthenticated",
        authContent.auth.errors.unauthenticated,
        401,
      );
    }
    if (e instanceof AccountSuspendedError) {
      return errJson(
        "account_suspended",
        authContent.auth.errors.accountSuspended,
        403,
      );
    }
    if (e instanceof ProfileIncompleteError) {
      return errJson(
        "profile_incomplete",
        authContent.auth.errors.profileIncomplete,
        403,
      );
    }
    throw e;
  }

  const supabase = createServerSupabase();
  const stats = await getDashboardStats(supabase, ctx.user.id);
  return okJson(stats);
}
