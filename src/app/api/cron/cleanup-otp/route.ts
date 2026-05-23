import { NextResponse, type NextRequest } from "next/server";

import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Cleanup entry point that wipes `otp_codes` rows older than one hour
 * past their expiry. Designed to be called by an **external scheduler**
 * (GitHub Actions cron, Cloudflare Workers / Cron Triggers, Upstash
 * QStash, etc.) — we no longer ship a `crons` block in `vercel.json`
 * because Vercel's Hobby tier caps cron frequency at once per day,
 * which isn't enough to keep the OTP table tidy.
 *
 * Auth: requires the `CRON_SECRET` env var, sent as
 * `Authorization: Bearer <CRON_SECRET>`. Without that header the
 * endpoint returns 401, so an attacker who finds the URL can't trigger
 * the cleanup by hitting it directly.
 *
 * Example GitHub Actions invocation:
 *
 *   curl -fsSL -X GET \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     "$APP_BASE_URL/api/cron/cleanup-otp"
 *
 * Even if the cron stops running entirely, expired OTPs are still
 * rejected at verify-time — this job is only about keeping the table
 * small.
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
