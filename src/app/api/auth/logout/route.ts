import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Calls Supabase `signOut()` which both revokes the refresh token
 * server-side and (via the SSR cookie helpers) clears the access /
 * refresh cookies from the response. Always returns `{ ok: true }` —
 * even if the user wasn't signed in, this is the desired post-state.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  try {
    await supabase.auth.signOut();
  } catch (e) {
    // signOut throws on network failure — but the local cookie is
    // already cleared by the time we get here, so a 200 is honest.
    console.error("[api/auth/logout] remote signOut failed", e);
  }
  return NextResponse.json({ ok: true, redirect: "/login" });
}
