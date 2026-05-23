import { NextResponse, type NextRequest } from "next/server";

import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Vercel-cron entry point that wipes `otp_codes` rows older than one
 * hour past their expiry. Scheduled in `vercel.json` to run every 30
 * minutes.
 *
 * Auth: requires the `CRON_SECRET` env var as a bearer token. Vercel's
 * cron invocations are signed with this header so an attacker can't
 * trigger the cleanup by hitting the endpoint directly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "cron_not_configured", message: "CRON_SECRET is not set" } },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid cron token" } },
      { status: 401 },
    );
  }

  const supabase = createServiceSupabase();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from("otp_codes")
    .delete({ count: "exact" })
    .lt("expires_at", cutoff);

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "cleanup_failed",
          message: `[cron/cleanup-otp] ${error.message}`,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: { deleted: count ?? 0, cutoff },
  });
}
