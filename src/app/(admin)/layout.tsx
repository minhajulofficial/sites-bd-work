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
 */
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
