import { NextResponse } from "next/server";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  UnauthorizedError,
  requireUser,
} from "@/lib/auth/session";
import { getActiveBanners } from "@/lib/dashboard/banners";
import { createServerSupabase } from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/banners
 *
 * Returns the list of currently-active dashboard banner slides,
 * sorted by `display_order`. Authentication required — the
 * `banners` RLS policy only exposes rows to `authenticated`
 * callers, so the route mirrors that gate at the API layer to
 * return a meaningful 401 instead of an empty array.
 *
 * Response: `{ data: DashboardBanner[] }`.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireUser();
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
    throw e;
  }

  const supabase = createServerSupabase();
  const banners = await getActiveBanners(supabase);
  return okJson(banners);
}
