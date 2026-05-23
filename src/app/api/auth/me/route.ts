import { NextResponse } from "next/server";

import { okJson } from "@/lib/api/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * Lightweight "am I signed in?" probe used by public-page client
 * components that need to branch UX on auth state without forcing the
 * host page itself to opt into dynamic rendering.
 *
 *   - 200 `{ data: { user: { id, email } } }` when a valid Supabase
 *     session cookie is present.
 *   - 200 `{ data: { user: null } }` for guests (never 401 — the
 *     caller just wants to know which branch to render).
 *
 * Deliberately does NOT look up the `profiles` row — it is hot path
 * for every page transition that depends on auth state, and the
 * caller only needs an opaque user-or-null signal. Pages that need
 * the profile (status, name, customer id) should keep using
 * `requireProfileVerified()` server-side.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return okJson({ user: null });
  }

  return okJson({
    user: {
      id: user.id,
      email: user.email ?? "",
    },
  });
}
