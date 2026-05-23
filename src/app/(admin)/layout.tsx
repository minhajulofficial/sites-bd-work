import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  AccountSuspendedError,
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth/session";

/**
 * Shared chrome + auth guard for every `/admin/*` route. The
 * middleware already enforces the admin gate, but re-checking inside
 * the layout means an attacker who somehow bypasses the edge guard
 * still can't render an admin page server-side.
 *
 * Marked `force-dynamic` so the admin pages never run through static
 * prerender at build time. `requireAdmin()` resolves the current user
 * from the request cookie via `createServerSupabase()`, which throws
 * `[supabase/server] NEXT_PUBLIC_SUPABASE_URL ... required` when no
 * request context is available — i.e. during `next build`. Opting
 * the whole admin group out of static rendering means every admin
 * page (including the PR-22 / PR-24 / PR-25 placeholders) is rendered
 * on demand, and the Vercel build stops failing on the prerender step
 * even when the project doesn't have the public Supabase keys wired
 * in. The auth guard itself is unchanged.
 */
export const dynamic = "force-dynamic";

export default async function AdminGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    if (e instanceof AccountSuspendedError) redirect("/login?error=suspended");
    if (e instanceof ForbiddenError) redirect("/dash");
    throw e;
  }

  return (
    <AdminLayout userEmail={ctx.profile.email}>{children}</AdminLayout>
  );
}
